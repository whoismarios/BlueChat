"""blueChat Python sandbox: stateful Jupyter kernel per chat session, exposed via FastAPI."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import mimetypes
import re
import unicodedata
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Path as PathParam, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .kernels import SESSIONS_DIR, KernelRegistry, list_files

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("sandbox")

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
SESSION_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
WIDGET_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
MAX_WIDGET_VALUES = 50
INLINE_TYPES = ("image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf")

registry = KernelRegistry()


async def _reaper() -> None:
    while True:
        await asyncio.sleep(60)
        try:
            await registry.reap_idle()
        except Exception:
            log.exception("idle reaper failed")


@asynccontextmanager
async def lifespan(_: FastAPI):
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    task = asyncio.create_task(_reaper())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
        await registry.shutdown_all()


app = FastAPI(title="blueChat Python Sandbox", lifespan=lifespan)


def session_id_param(session_id: str = PathParam(...)) -> str:
    if not SESSION_ID_RE.match(session_id):
        raise HTTPException(400, "invalid session_id")
    return session_id


def _safe_path(session_id: str, rel: str) -> Path:
    workdir = (SESSIONS_DIR / session_id).resolve()
    target = (workdir / rel).resolve()
    if not target.is_relative_to(workdir) or target == workdir:
        raise HTTPException(400, "invalid path")
    if any(part.startswith(".") for part in target.relative_to(workdir).parts):
        raise HTTPException(404, "file not found")
    return target


def _sanitize_filename(name: str | None) -> str:
    name = unicodedata.normalize("NFC", Path((name or "").replace("\\", "/")).name)
    name = re.sub(r"[^\w.\- ()äöüÄÖÜß]", "_", name).strip(" .")
    name = name.lstrip(".")
    return name[:200] or "upload"


# ------------------------------------------------------------------ endpoints
class ExecuteRequest(BaseModel):
    session_id: str
    code: str
    timeout: int = Field(default=120, ge=1, le=900)


WidgetValue = float | int | bool | str


class WidgetRequest(BaseModel):
    session_id: str
    widget_id: str
    values: dict[str, WidgetValue] = Field(default_factory=dict)
    timeout: int = Field(default=60, ge=1, le=900)


def _sandbox_error(exc: Exception) -> dict:
    return {
        "status": "error",
        "outputs": [
            {
                "type": "error",
                "ename": "SandboxError",
                "evalue": f"Interner Fehler der Sandbox: {exc}",
                "traceback": "",
            }
        ],
        "files": [],
        "duration_ms": 0,
    }


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/execute")
async def execute(req: ExecuteRequest) -> dict:
    if not SESSION_ID_RE.match(req.session_id):
        raise HTTPException(400, "invalid session_id")
    try:
        return await registry.execute(req.session_id, req.code, req.timeout)
    except Exception as exc:
        log.exception("execution failed for %s", req.session_id)
        return _sandbox_error(exc)


@app.post("/widget")
async def widget(req: WidgetRequest) -> dict:
    """Re-run a widget function registered by `interact` with new control values."""
    if not SESSION_ID_RE.match(req.session_id):
        raise HTTPException(400, "invalid session_id")
    if not WIDGET_ID_RE.match(req.widget_id):
        raise HTTPException(400, "invalid widget_id")
    if len(req.values) > MAX_WIDGET_VALUES:
        raise HTTPException(400, "too many values")
    values = {str(k)[:100]: (v[:1000] if isinstance(v, str) else v) for k, v in req.values.items()}
    try:
        return await registry.run_widget(req.session_id, req.widget_id, values, req.timeout)
    except Exception as exc:
        log.exception("widget run failed for %s", req.session_id)
        return _sandbox_error(exc)


@app.post("/sessions/{session_id}/upload")
async def upload(file: UploadFile, session_id: str = Depends(session_id_param)) -> dict:
    name = _sanitize_filename(file.filename)
    workdir = SESSIONS_DIR / session_id
    workdir.mkdir(parents=True, exist_ok=True)
    target = _safe_path(session_id, name)
    tmp = target.with_name(f".upload-{name}")
    size = 0
    try:
        with tmp.open("wb") as fh:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, f"file too large (max {MAX_UPLOAD_BYTES // 2**20} MB)")
                fh.write(chunk)
        tmp.replace(target)
    finally:
        tmp.unlink(missing_ok=True)
    return {"name": name, "path": name, "size": size}


@app.get("/sessions/{session_id}/files")
async def files(session_id: str = Depends(session_id_param)) -> list[dict]:
    return list_files(SESSIONS_DIR / session_id)


@app.get("/sessions/{session_id}/files/{path:path}")
async def download(path: str, download: bool = False, session_id: str = Depends(session_id_param)):
    target = _safe_path(session_id, path)
    if not target.is_file():
        raise HTTPException(404, "file not found")
    media_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    inline = not download and media_type in INLINE_TYPES
    headers = {"X-Content-Type-Options": "nosniff"}
    if media_type != "application/pdf":  # Chrome's PDF viewer refuses sandboxed documents
        headers["Content-Security-Policy"] = "sandbox"
    return FileResponse(
        target,
        media_type=media_type,
        filename=target.name,
        content_disposition_type="inline" if inline else "attachment",
        headers=headers,
    )


@app.post("/sessions/{session_id}/reset")
async def reset(session_id: str = Depends(session_id_param)) -> dict:
    await registry.reset(session_id)
    return {"status": "ok"}


@app.delete("/sessions/{session_id}")
async def delete(session_id: str = Depends(session_id_param)) -> dict:
    await registry.delete(session_id)
    return {"status": "deleted"}

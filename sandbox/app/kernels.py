"""Per-session stateful Jupyter kernels."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import queue
import shutil
import time
from dataclasses import dataclass, field
from pathlib import Path

from jupyter_client import AsyncKernelManager

from .outputs import EXPORT_PREFIX, OutputCollector

log = logging.getLogger("sandbox.kernels")

WORKSPACE = Path(os.environ.get("WORKSPACE_DIR", "/workspace"))
SESSIONS_DIR = WORKSPACE / "sessions"
IDLE_TIMEOUT_S = int(os.environ.get("KERNEL_IDLE_TIMEOUT_S", 30 * 60))
INTERRUPT_GRACE_S = 5
MAX_TRACKED_FILES = 5_000

STARTUP_CODE_TEMPLATE = """
%matplotlib inline
import warnings as _w
import matplotlib as _mpl
import matplotlib.pyplot as _plt
from matplotlib_inline.backend_inline import set_matplotlib_formats as _smf
_smf("png")
_plt.rcParams.update({
    "figure.figsize": (8, 4.5),
    "figure.dpi": 110,
    "savefig.dpi": 110,
    "font.family": "DejaVu Sans",
    "axes.grid": True,
    "grid.alpha": 0.3,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.prop_cycle": _mpl.cycler(color=["#0060a8", "#00a3e0", "#f39200", "#5a8f29", "#c8102e", "#7d6aa6", "#8c8c8c"]),
})
import pandas as _pd
_pd.set_option("display.max_rows", 60)
_pd.set_option("display.min_rows", 20)
_pd.set_option("display.max_columns", 30)
_pd.set_option("display.width", 160)
_pd.set_option("display.max_colwidth", 80)
import plotly.io as _pio
import plotly.graph_objects as _go
_pio.renderers.default = "plotly_mimetype"
_axis = dict(gridcolor="rgba(128,128,128,0.18)", zerolinecolor="rgba(128,128,128,0.35)",
             linecolor="rgba(128,128,128,0.35)", automargin=True)
_pio.templates["bluechat"] = _go.layout.Template(layout=dict(
    colorway=["#0050a0", "#00a3e0", "#7fb6e6", "#003d73", "#f59e0b", "#12805c", "#c2372f", "#6b7f96"],
    font=dict(family="Instrument Sans, system-ui, sans-serif"),
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    xaxis=_axis, yaxis=_axis,
    hoverlabel=dict(font=dict(family="Instrument Sans, system-ui, sans-serif")),
))
_pio.templates.default = "plotly_white+bluechat"
_w.filterwarnings("ignore", category=DeprecationWarning)
del _w, _mpl, _plt, _smf, _pd, _pio, _go, _axis
def _bluechat_install_export():
    import importlib.util, os, sys
    spec = importlib.util.spec_from_file_location("_bluechat_export", {export_module!r})
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    sys.modules["_bluechat_export"] = mod
    mod.install(get_ipython(), os.getcwd())
try:
    _bluechat_install_export()
except Exception as _e:
    print("bluechat export formatter not installed:", _e)
finally:
    del _bluechat_install_export
def _bluechat_install_widgets():
    import importlib.util, sys
    spec = importlib.util.spec_from_file_location("_bluechat_widgets", {widgets_module!r})
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    sys.modules["_bluechat_widgets"] = mod
    mod.install(get_ipython())
try:
    _bluechat_install_widgets()
except Exception as _e:
    print("bluechat widgets not installed:", _e)
finally:
    del _bluechat_install_widgets
"""
STARTUP_CODE = STARTUP_CODE_TEMPLATE.replace(
    "{export_module!r}", repr(str(Path(__file__).with_name("kernel_export.py")))
).replace("{widgets_module!r}", repr(str(Path(__file__).with_name("kernel_widgets.py"))))

WIDGET_RERUN_TEMPLATE = (
    "__import__('sys').modules['_bluechat_widgets'].rerun({widget_id!r}, "
    "__import__('json').loads({values!r}))"
)


def widget_rerun_code(widget_id: str, values: dict) -> str:
    """Kernel code that re-runs a registered widget function with the given values."""
    return WIDGET_RERUN_TEMPLATE.format(widget_id=widget_id, values=json.dumps(values))


def _is_visible(rel: Path) -> bool:
    return not any(part.startswith(".") or part == "__pycache__" for part in rel.parts)


def list_files(workdir: Path) -> list[dict]:
    """All visible files below workdir as [{name, path, size}] sorted by path."""
    return [
        {"name": Path(p).name, "path": p, "size": size}
        for p, (_, size) in sorted(snapshot(workdir).items())
    ]


def snapshot(workdir: Path) -> dict[str, tuple[int, int]]:
    """Map relative path -> (mtime_ns, size) for visible files."""
    result: dict[str, tuple[int, int]] = {}
    if not workdir.is_dir():
        return result
    for root, dirs, files in os.walk(workdir):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__pycache__"]
        for fname in files:
            if fname.startswith("."):
                continue
            full = Path(root) / fname
            try:
                st = full.stat()
            except OSError:
                continue
            if not full.is_file():
                continue
            rel = full.relative_to(workdir)
            if _is_visible(rel):
                result[rel.as_posix()] = (st.st_mtime_ns, st.st_size)
            if len(result) >= MAX_TRACKED_FILES:
                return result
    return result


@dataclass
class KernelSession:
    session_id: str
    workdir: Path
    km: AsyncKernelManager | None = None
    kc: object | None = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    last_used: float = field(default_factory=time.monotonic)
    closed: bool = False

    # ---------------------------------------------------------------- lifecycle
    async def start(self) -> None:
        self.workdir.mkdir(parents=True, exist_ok=True)
        km = AsyncKernelManager(kernel_name="python3")
        await km.start_kernel(cwd=str(self.workdir), env=self._kernel_env())
        kc = km.client()
        kc.start_channels()
        try:
            await kc.wait_for_ready(timeout=60)
        except Exception:
            kc.stop_channels()
            await km.shutdown_kernel(now=True)
            raise
        self.km, self.kc = km, kc
        await self._run_startup()
        log.info("kernel started for session %s", self.session_id)

    def _kernel_env(self) -> dict[str, str]:
        env = {k: v for k, v in os.environ.items() if not k.startswith(("SANDBOX_", "UVICORN_"))}
        env["PWD"] = str(self.workdir)
        return env

    async def _run_startup(self) -> None:
        collector = OutputCollector(self.workdir)
        await self._execute(STARTUP_CODE, timeout=60, collector=collector, silent=True)
        if collector.had_error:
            log.warning("startup code failed for %s: %s", self.session_id, collector.items)

    async def shutdown(self, now: bool = False) -> None:
        kc, km = self.kc, self.km
        self.kc = self.km = None
        if kc is not None:
            kc.stop_channels()
        if km is not None:
            try:
                await km.shutdown_kernel(now=now)
            except Exception:
                log.exception("kernel shutdown failed for %s", self.session_id)
                try:
                    await km.shutdown_kernel(now=True)
                except Exception:
                    pass

    async def restart(self, now: bool = False) -> None:
        await self.shutdown(now=now)
        await self.start()

    async def is_alive(self) -> bool:
        return self.km is not None and await self.km.is_alive()

    async def ensure_running(self) -> None:
        if not await self.is_alive():
            if self.km is not None:
                log.warning("kernel for %s died – restarting", self.session_id)
            await self.restart(now=True)

    # ---------------------------------------------------------------- execution
    async def run(self, code: str, timeout: int, store_history: bool = True) -> dict:
        """Execute code, return the /execute response body. Caller must hold self.lock."""
        started = time.monotonic()
        self.last_used = started
        await self.ensure_running()

        before = snapshot(self.workdir)
        collector = OutputCollector(self.workdir)
        status = await self._execute(
            code, timeout=timeout, collector=collector, store_history=store_history
        )
        after = snapshot(self.workdir)

        files = [
            {"name": Path(p).name, "path": p, "size": meta[1]}
            for p, meta in sorted(after.items())
            if before.get(p) != meta and not p.startswith(EXPORT_PREFIX)
        ]
        self.last_used = time.monotonic()
        return {
            "status": status,
            "outputs": collector.items,
            "files": files,
            "duration_ms": int((time.monotonic() - started) * 1000),
        }

    async def _execute(
        self,
        code: str,
        timeout: float,
        collector: OutputCollector,
        silent: bool = False,
        store_history: bool = True,
    ) -> str:
        kc = self.kc
        msg_id = kc.execute(
            code, silent=silent, store_history=store_history and not silent, allow_stdin=False
        )
        deadline = time.monotonic() + timeout
        timed_out = False

        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                if timed_out:  # interrupt did not bring the kernel back to idle
                    collector.close_widgets()
                    collector.drop_keyboard_interrupt()
                    collector.add_error(
                        "TimeoutError",
                        f"Zeitlimit von {timeout:.0f}s überschritten. Der Kernel reagierte nicht auf "
                        "den Abbruch und wurde neu gestartet – alle Variablen sind verloren.",
                        "",
                    )
                    await self.restart(now=True)
                    return "timeout"
                timed_out = True
                log.info("timeout in session %s – interrupting kernel", self.session_id)
                await self.km.interrupt_kernel()
                deadline = time.monotonic() + INTERRUPT_GRACE_S
                continue

            try:
                msg = await kc.get_iopub_msg(timeout=min(1.0, remaining))
            except queue.Empty:
                if not await self.km.is_alive():
                    collector.close_widgets()
                    collector.add_error(
                        "KernelDied",
                        "Der Python-Kernel ist abgestürzt (z. B. Speicherlimit überschritten) und "
                        "wurde neu gestartet – alle Variablen sind verloren.",
                        "",
                    )
                    await self.restart(now=True)
                    return "error"
                continue

            if msg.get("parent_header", {}).get("msg_id") != msg_id:
                continue
            if msg["header"]["msg_type"] == "status":
                if msg["content"].get("execution_state") == "idle":
                    break
                continue
            collector.handle(msg)

        await self._drain_shell_reply(msg_id)

        collector.close_widgets()
        if timed_out:
            collector.drop_keyboard_interrupt()
            collector.add_error(
                "TimeoutError",
                f"Zeitlimit von {timeout:.0f}s überschritten – die Ausführung wurde abgebrochen. "
                "Der Kernel-Zustand (Variablen von vorher) bleibt erhalten.",
                "",
            )
            return "timeout"
        return "error" if collector.had_error else "ok"

    async def _drain_shell_reply(self, msg_id: str) -> None:
        end = time.monotonic() + 5
        while time.monotonic() < end:
            try:
                reply = await self.kc.get_shell_msg(timeout=max(0.1, end - time.monotonic()))
            except queue.Empty:
                return
            if reply.get("parent_header", {}).get("msg_id") == msg_id:
                return


class KernelRegistry:
    def __init__(self) -> None:
        self.sessions: dict[str, KernelSession] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def workdir(session_id: str) -> Path:
        return SESSIONS_DIR / session_id

    async def get(self, session_id: str) -> KernelSession:
        async with self._lock:
            session = self.sessions.get(session_id)
            if session is None:
                session = KernelSession(session_id, self.workdir(session_id))
                self.sessions[session_id] = session
            return session

    async def execute(self, session_id: str, code: str, timeout: int) -> dict:
        while True:
            session = await self.get(session_id)
            async with session.lock:
                if not session.closed:  # may have been deleted/reaped while waiting
                    return await session.run(code, timeout)

    async def run_widget(self, session_id: str, widget_id: str, values: dict, timeout: int) -> dict:
        """Re-run a registered widget function (no IPython history entry)."""
        code = widget_rerun_code(widget_id, values)
        while True:
            session = await self.get(session_id)
            async with session.lock:
                if not session.closed:
                    return await session.run(code, timeout, store_history=False)

    async def reset(self, session_id: str) -> None:
        while True:
            session = await self.get(session_id)
            async with session.lock:
                if not session.closed:
                    await session.restart()
                    session.last_used = time.monotonic()
                    return

    async def delete(self, session_id: str) -> None:
        async with self._lock:
            session = self.sessions.pop(session_id, None)
        if session is not None:
            session.closed = True
            async with session.lock:
                await session.shutdown()
        shutil.rmtree(self.workdir(session_id), ignore_errors=True)

    async def reap_idle(self) -> None:
        now = time.monotonic()
        async with self._lock:
            idle = [
                s
                for s in self.sessions.values()
                if not s.lock.locked() and now - s.last_used > IDLE_TIMEOUT_S
            ]
            for s in idle:
                s.closed = True
                self.sessions.pop(s.session_id, None)
        for s in idle:
            log.info("shutting down idle kernel %s", s.session_id)
            async with s.lock:
                await s.shutdown()

    async def shutdown_all(self) -> None:
        async with self._lock:
            sessions = list(self.sessions.values())
            self.sessions.clear()
        await asyncio.gather(*(s.shutdown() for s in sessions), return_exceptions=True)

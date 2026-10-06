"""Convert Jupyter iopub messages into blueChat output items (see lib/types.ts PythonOutputItem)."""

from __future__ import annotations

import base64
import csv
import logging
import re
import uuid
from pathlib import Path
from typing import Any

import numpy as np
import plotly.io as pio

log = logging.getLogger("sandbox.outputs")

MAX_TEXT_CHARS = 100_000
MAX_HTML_CHARS = 2_000_000

PLOTLY_MIME = "application/vnd.plotly.v1+json"
EXPORT_MIME = "application/vnd.bluechat.export+json"  # produced by kernel_export.py
WIDGET_MIME = "application/vnd.bluechat.widget+json"  # produced by kernel_widgets.py
EXPORT_DIR = "exports"
EXPORT_PREFIX = EXPORT_DIR + "/"
EXPORT_KEYS = ("name", "path", "rows", "columns", "size")
MAX_EXPORT_ROWS = 500_000
ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07")

_PLOTLY_PAGE_CSS = (
    "<style>html,body{height:100%;margin:0;padding:0;background:transparent;}"
    "body>div{height:100%;}</style>"
)


def strip_ansi(text: str) -> str:
    return ANSI_RE.sub("", text)


def truncate(text: str, limit: int = MAX_TEXT_CHARS) -> str:
    if len(text) <= limit:
        return text
    omitted = len(text) - limit
    return text[:limit] + f"\n... [Ausgabe gekürzt: {omitted} weitere Zeichen ausgelassen]"


def _as_text(value: Any) -> str:
    if isinstance(value, list):
        return "".join(value)
    return str(value)


def _plotly_title(fig: dict) -> str:
    title = (fig.get("layout") or {}).get("title")
    if isinstance(title, dict):
        title = title.get("text")
    return title or "ohne Titel"


def plotly_to_html(fig: dict) -> str:
    """Render a plotly figure dict as a standalone, responsive HTML page (plotly.js from CDN)."""
    html = pio.to_html(
        {"data": fig.get("data", []), "layout": fig.get("layout", {})},
        include_plotlyjs="cdn",
        full_html=True,
        validate=False,
        config={"responsive": True, "displaylogo": False},
        default_width="100%",
        default_height="100%",
    )
    return html.replace("<head>", "<head>" + _PLOTLY_PAGE_CSS, 1)


# ---------------------------------------------------------------- plotly CSV export
def _decode_typed_arrays(obj: Any) -> Any:
    """Recursively decode plotly's {"dtype", "bdata", "shape"?} typed-array specs to lists."""
    if isinstance(obj, dict):
        if "bdata" in obj and "dtype" in obj:
            arr = np.frombuffer(base64.b64decode(obj["bdata"]), dtype=np.dtype(obj["dtype"]).newbyteorder("<"))
            shape = obj.get("shape")
            if shape:
                dims = [int(d) for d in str(shape).split(",")] if not isinstance(shape, list) else shape
                arr = arr.reshape(dims)
            return arr.tolist()
        return {k: _decode_typed_arrays(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_decode_typed_arrays(v) for v in obj]
    return obj


def _seq(value: Any) -> list | None:
    if value is None:
        return None
    if isinstance(value, (list, tuple)):
        return list(value)
    return None  # scalars / strings are not data series


def _plotly_rows(fig: dict) -> tuple[list[list], bool]:
    rows: list[list] = []
    has_z = False
    for i, trace in enumerate(_decode_typed_arrays(fig.get("data") or [])):
        name = trace.get("name") or f"Serie {i + 1}"
        typ = trace.get("type") or "scatter"
        x, y, z = _seq(trace.get("x")), _seq(trace.get("y")), _seq(trace.get("z"))
        if typ in ("pie", "funnelarea"):
            x, y = _seq(trace.get("labels")), _seq(trace.get("values"))
        if z is not None and z and isinstance(z[0], list):  # 2-D grid (heatmap, contour, surface)
            has_z = True
            for r, zrow in enumerate(z):
                for c, zval in enumerate(zrow):
                    xv = x[c] if x and c < len(x) else c
                    yv = y[r] if y and r < len(y) else r
                    rows.append([name, typ, xv, yv, zval])
            continue
        if z is not None:
            has_z = True
        n = max(len(s) for s in (x, y, z) if s is not None) if any(
            s is not None for s in (x, y, z)) else 0
        if x is None and y is not None and z is None and not typ.startswith("histogram"):
            x = list(range(n))  # plotly's implicit index
        for k in range(n):
            rows.append([
                name, typ,
                x[k] if x is not None and k < len(x) else None,
                y[k] if y is not None and k < len(y) else None,
                z[k] if z is not None and k < len(z) else None,
            ])
        if len(rows) >= MAX_EXPORT_ROWS:
            break
    return rows[:MAX_EXPORT_ROWS], has_z


def write_plotly_export(fig: dict, workdir: Path) -> dict | None:
    rows, has_z = _plotly_rows(fig)
    if not rows:
        return None
    header = ["serie", "typ", "x", "y"] + (["z"] if has_z else [])
    name = f"plotly-{uuid.uuid4().hex[:8]}.csv"
    target = workdir / EXPORT_DIR / name
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.writer(fh, lineterminator="\n")
        writer.writerow(header)
        for row in rows:
            writer.writerow(["" if v is None else v for v in row[: len(header)]])
    return {"name": name, "path": f"{EXPORT_PREFIX}{name}", "rows": len(rows),
            "columns": len(header), "size": target.stat().st_size}


def _kernel_export(data: dict[str, Any]) -> dict | None:
    meta = data.get(EXPORT_MIME)
    if isinstance(meta, dict) and all(k in meta for k in EXPORT_KEYS):
        return {k: meta[k] for k in EXPORT_KEYS}
    return None


def convert_mimebundle(data: dict[str, Any], workdir: Path | None = None) -> dict | None:
    """Pick the richest supported representation of an execute_result/display_data bundle."""
    item = _convert(data, workdir)
    export = _kernel_export(data)
    if export and item and item["type"] in ("image", "html") and "export" not in item:
        item["export"] = export
        if item["type"] == "html" and export["name"].startswith("tabelle-"):
            item["kind"] = "table"  # e.g. pandas Styler (no class="dataframe")
    elif export and workdir is not None:
        # nothing to attach it to (e.g. a Series shown as plain text) -> drop the orphan file
        try:
            target = (workdir / export["path"]).resolve()
            if target.is_relative_to((workdir / EXPORT_DIR).resolve()):
                target.unlink(missing_ok=True)
        except Exception:
            pass
    return item


def _convert(data: dict[str, Any], workdir: Path | None) -> dict | None:
    text_plain = _as_text(data["text/plain"]) if "text/plain" in data else None

    if PLOTLY_MIME in data:
        fig = data[PLOTLY_MIME]
        try:
            item = {
                "type": "html",
                "kind": "plotly",
                "html": plotly_to_html(fig),
                "text": f"<plotly figure: {_plotly_title(fig)}>",
            }
            if workdir is not None:
                try:
                    export = write_plotly_export(fig, workdir)
                    if export:
                        item["export"] = export
                except Exception:
                    log.exception("plotly CSV export failed")
            return item
        except Exception as exc:  # fall back to other representations
            text_plain = text_plain or f"<plotly figure (Rendering fehlgeschlagen: {exc})>"

    for mime in ("image/png", "image/jpeg"):
        if mime in data:
            item = {"type": "image", "mime": mime, "data": re.sub(r"\s+", "", _as_text(data[mime]))}
            if text_plain:
                item["text"] = truncate(text_plain, 2_000)
            return item

    if "image/svg+xml" in data:
        item = {"type": "image", "mime": "image/svg+xml", "data": _as_text(data["image/svg+xml"])}
        if text_plain:
            item["text"] = truncate(text_plain, 2_000)
        return item

    if "text/html" in data:
        html = _as_text(data["text/html"])
        item = {
            "type": "html",
            "kind": "table" if 'class="dataframe' in html else "generic",
            "html": truncate(html, MAX_HTML_CHARS),
        }
        if text_plain:
            item["text"] = truncate(text_plain)
        return item

    if text_plain is not None:
        return {"type": "text", "text": truncate(text_plain)}

    return None


class OutputCollector:
    """Accumulates output items for one execution.

    Widget markers (WIDGET_MIME, see kernel_widgets.py) open/close a `widget` item; everything
    emitted in between is collected into that widget's `outputs` (nesting is supported).
    """

    def __init__(self, workdir: Path | None = None) -> None:
        self.workdir = workdir
        self.items: list[dict] = []
        self.had_error = False
        self._widgets: list[dict] = []  # stack of open widget items

    @property
    def _target(self) -> list[dict]:
        return self._widgets[-1]["outputs"] if self._widgets else self.items

    def handle(self, msg: dict) -> None:
        msg_type = msg["header"]["msg_type"]
        content = msg["content"]

        if msg_type == "stream":
            self._add_stream(content.get("name", "stdout"), content.get("text", ""))
        elif msg_type in ("execute_result", "display_data", "update_display_data"):
            data = content.get("data", {})
            if WIDGET_MIME in data:
                self._widget_marker(data[WIDGET_MIME])
                return
            item = convert_mimebundle(data, self.workdir)
            if item:
                self._target.append(item)
        elif msg_type == "error":
            self.add_error(
                content.get("ename", "Error"),
                content.get("evalue", ""),
                "\n".join(strip_ansi(line) for line in content.get("traceback", [])),
            )
        elif msg_type == "clear_output":
            self._target.clear()

    def _widget_marker(self, payload: Any) -> None:
        if not isinstance(payload, dict):
            return
        event = payload.get("event")
        if event == "start" and isinstance(payload.get("id"), str):
            controls = payload.get("controls")
            item: dict = {
                "type": "widget",
                "id": payload["id"],
                "controls": controls if isinstance(controls, list) else [],
                "outputs": [],
            }
            if payload.get("title"):
                item["title"] = str(payload["title"])
            self._target.append(item)
            self._widgets.append(item)
        elif event == "end":
            for i in range(len(self._widgets) - 1, -1, -1):
                if self._widgets[i]["id"] == payload.get("id"):
                    del self._widgets[i:]
                    break
        elif event == "missing":
            self.add_error("WidgetInaktiv", str(payload.get("message") or "Das Widget ist nicht mehr aktiv."), "")

    def _add_stream(self, name: str, text: str) -> None:
        name = "stderr" if name == "stderr" else "stdout"
        target = self._target
        last = target[-1] if target else None
        if last and last["type"] == "stream" and last["name"] == name:
            if len(last["text"]) > MAX_TEXT_CHARS:  # already truncated
                return
            last["text"] = truncate(last["text"] + text)
        else:
            target.append({"type": "stream", "name": name, "text": truncate(text)})

    def add_error(self, ename: str, evalue: str, traceback: str) -> None:
        self.had_error = True
        self._target.append(
            {"type": "error", "ename": ename, "evalue": evalue, "traceback": truncate(traceback)}
        )

    def close_widgets(self) -> None:
        """Called when the execution is over (e.g. timeout inside a widget): later items go top-level."""
        self._widgets.clear()

    def drop_keyboard_interrupt(self) -> None:
        def strip(items: list[dict]) -> list[dict]:
            out = []
            for i in items:
                if i["type"] == "error" and i["ename"] == "KeyboardInterrupt":
                    continue
                if i["type"] == "widget":
                    i["outputs"] = strip(i["outputs"])
                out.append(i)
            return out

        self.items = strip(self.items)

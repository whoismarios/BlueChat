"""Runs INSIDE the Jupyter kernel (loaded by the startup code via runpy).

Registers an IPython formatter for EXPORT_MIME that writes the data behind displayed pandas
objects and matplotlib figures as CSV to <workdir>/exports/ and returns its metadata
({name, path, rows, columns, size}). outputs.py attaches it to the matching output item.
Must never raise: any failure simply yields no export.
"""

from __future__ import annotations

import math
import os
import re
import uuid

EXPORT_MIME = "application/vnd.bluechat.export+json"
EXPORT_DIR = "exports"
MAX_FIGURE_ROWS = 500_000
MAX_TABLE_ROWS = 1_000_000
_AUTO_LABEL = re.compile(r"^_(line|child|container|collection)\d+$")


def write_csv(df, workdir: str, kind: str, index: bool = False) -> dict | None:
    """Write df as UTF-8-with-BOM CSV to exports/<kind>-<id>.csv, return export metadata."""
    name = f"{kind}-{uuid.uuid4().hex[:8]}.csv"
    rel = f"{EXPORT_DIR}/{name}"
    full = os.path.join(workdir, EXPORT_DIR, name)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    df.to_csv(full, index=index, encoding="utf-8-sig")
    columns = df.shape[1] + (df.index.nlevels if index else 0)
    return {"name": name, "path": rel, "rows": int(df.shape[0]), "columns": int(columns),
            "size": os.path.getsize(full)}


# ---------------------------------------------------------------- pandas
def _export_pandas(obj, workdir: str) -> dict | None:
    import pandas as pd

    if not isinstance(obj, (pd.DataFrame, pd.Series)) and isinstance(
        getattr(obj, "data", None), pd.DataFrame
    ):  # pandas Styler
        obj = obj.data
    if isinstance(obj, pd.Series):
        obj = obj.to_frame(name=obj.name if obj.name is not None else "Wert")
    if not isinstance(obj, pd.DataFrame) or obj.shape[1] == 0:
        return None
    if len(obj) > MAX_TABLE_ROWS:
        obj = obj.iloc[:MAX_TABLE_ROWS]
    idx = obj.index
    default_index = (
        isinstance(idx, pd.RangeIndex) and idx.start == 0 and idx.step == 1 and idx.name is None
    )
    return write_csv(obj, workdir, "tabelle", index=not default_index)


# ---------------------------------------------------------------- matplotlib
def _converter(axis):
    getter = getattr(axis, "get_converter", None)
    return getter() if getter else getattr(axis, "converter", None)


def _axis_values(axis, values):
    """Map numeric axis coordinates back to categories / dates where possible."""
    import matplotlib.category as mcat
    import matplotlib.dates as mdates

    values = list(values)
    units = getattr(axis, "units", None)
    if isinstance(units, mcat.UnitData):
        inverse = {v: k for k, v in units._mapping.items()}
        return [inverse.get(int(round(v)), v) if _finite(v) else v for v in values]
    conv = _converter(axis)
    if conv is not None and "date" in type(conv).__name__.lower():
        out = []
        for v in values:
            try:
                out.append(mdates.num2date(v).replace(tzinfo=None).isoformat(sep=" "))
            except Exception:
                out.append(v)
        return out
    return values


def _finite(v) -> bool:
    try:
        return math.isfinite(float(v))
    except (TypeError, ValueError):
        return False


def _tick_label_map(axis) -> dict[float, str]:
    try:
        ticks = axis.get_ticklocs()
        labels = [t.get_text() for t in axis.get_ticklabels()]
        return {round(float(t), 6): lab for t, lab in zip(ticks, labels) if lab}
    except Exception:
        return {}


def _bar_categories(axis, centers):
    import matplotlib.category as mcat

    if isinstance(getattr(axis, "units", None), mcat.UnitData):
        return _axis_values(axis, centers)
    tick_map = _tick_label_map(axis)
    converted = _axis_values(axis, centers)
    return [tick_map.get(round(float(c), 6), conv) for c, conv in zip(centers, converted)]


def _series_name(label, prefix: str, counter: dict) -> str | None:
    label = str(label or "")
    counter[prefix] = counter.get(prefix, 0) + 1
    if label and not label.startswith("_"):
        return label
    if label == "" or label == "_nolegend_" or _AUTO_LABEL.match(label):
        return f"{prefix} {counter[prefix]}"
    counter[prefix] -= 1
    return None  # internal artist


def _figure_rows(fig) -> list[tuple]:
    import numpy as np
    from matplotlib.collections import PathCollection
    from matplotlib.container import BarContainer

    rows: list[tuple] = []

    def add(axname, serie, xs, ys):
        for x, y in zip(xs, ys):
            if len(rows) >= MAX_FIGURE_ROWS:
                return
            rows.append((axname, serie, _py(x), _py(y)))

    for ai, ax in enumerate(fig.axes):
        if not ax.get_visible() or ax.get_label() == "<colorbar>":
            continue
        axname = ax.get_title() or f"Achse {ai + 1}"
        counter: dict = {}

        for cont in ax.containers:
            if not isinstance(cont, BarContainer):
                continue
            serie = _series_name(cont.get_label(), "Balken", counter)
            if serie is None:
                continue
            horizontal = getattr(cont, "orientation", "vertical") == "horizontal"
            if horizontal:
                centers = [p.get_y() + p.get_height() / 2 for p in cont.patches]
                values = [p.get_width() for p in cont.patches]
                add(axname, serie, values, _bar_categories(ax.yaxis, centers))
            else:
                centers = [p.get_x() + p.get_width() / 2 for p in cont.patches]
                values = [p.get_height() for p in cont.patches]
                add(axname, serie, _bar_categories(ax.xaxis, centers), values)

        for line in ax.get_lines():
            if line.get_transform() != ax.transData:  # axhline/axvline etc. (axes coordinates)
                continue
            serie = _series_name(line.get_label(), "Linie", counter)
            if serie is None:
                continue
            xs, ys = np.ravel(line.get_xdata()), np.ravel(line.get_ydata())
            add(axname, serie, xs, ys)

        for coll in ax.collections:
            if not isinstance(coll, PathCollection) or coll.get_offset_transform() != ax.transData:
                continue
            offsets = np.asarray(coll.get_offsets())
            if offsets.ndim != 2 or len(offsets) == 0:
                continue
            serie = _series_name(coll.get_label(), "Punkte", counter)
            if serie is None:
                continue
            add(axname, serie, _axis_values(ax.xaxis, offsets[:, 0]),
                _axis_values(ax.yaxis, offsets[:, 1]))
    return rows


def _py(v):
    """numpy scalar -> plain python value (keeps CSV clean)."""
    item = getattr(v, "item", None)
    if item is not None:
        try:
            return item()
        except Exception:
            pass
    return v


def _export_figure(fig, workdir: str) -> dict | None:
    import pandas as pd

    rows = _figure_rows(fig)
    if not rows:
        return None
    df = pd.DataFrame(rows, columns=["achse", "serie", "x", "y"])
    return write_csv(df, workdir, "diagramm")


# ---------------------------------------------------------------- registration
def install(ip, workdir: str) -> None:
    from IPython.core.formatters import BaseFormatter
    from traitlets import ObjectName, Unicode

    class ExportFormatter(BaseFormatter):
        format_type = Unicode(EXPORT_MIME)
        print_method = ObjectName("_repr_bluechat_export_")
        _return_type = (dict,)

    def safe(func):
        def wrapper(obj):
            try:
                return func(obj, workdir)
            except Exception:
                return None
        return wrapper

    formatter = ExportFormatter(parent=ip.display_formatter)
    ip.display_formatter.formatters[EXPORT_MIME] = formatter
    import pandas as pd
    from matplotlib.figure import Figure

    for cls in (pd.DataFrame, pd.Series):
        formatter.for_type(cls, safe(_export_pandas))
    try:
        from pandas.io.formats.style import Styler  # needs jinja2

        formatter.for_type(Styler, safe(_export_pandas))
    except Exception:
        pass
    formatter.for_type(Figure, safe(_export_figure))

"""Runs INSIDE the Jupyter kernel (loaded by the startup code like kernel_export.py).

Interactive widgets for blueChat. The model writes

    @interact(vol=slider(0.05, 0.8, 0.05, 0.2, label="Volatilität"),
              modell=select(["GBM", "Merton"], label="Modell"),
              log=checkbox(False, label="Log-Skala"),
              title="Monte-Carlo-Simulation")
    def sim(vol, modell, log):
        ...  # plt.show() / fig.show() / display(df) / print / return fig

`interact` registers the function under a new id and emits a START marker (display_data with
WIDGET_MIME, event "start", {id, title, controls}), runs the function once with the default
values and emits an END marker. outputs.py nests everything between the markers into a
`widget` output item. The sandbox endpoint POST /widget calls `rerun(id, values)`, which
re-runs the registered function with validated values (no markers, plain outputs).
"""

from __future__ import annotations

import math
import uuid
from collections import OrderedDict

WIDGET_MIME = "application/vnd.bluechat.widget+json"
MAX_WIDGETS = 200
MAX_OPTIONS = 50
NOT_ACTIVE_MSG = (
    "Das Widget ist nicht mehr aktiv (Kernel wurde neu gestartet). Bitte Zelle erneut ausführen."
)

_REGISTRY: "OrderedDict[str, tuple]" = OrderedDict()


class Control(dict):
    """A control spec (plain dict, JSON-serialisable). `name` is filled in by interact."""


def _num(v):
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, int):
        return v
    f = float(v)
    if not math.isfinite(f):
        raise ValueError("Werte müssen endlich sein")
    return int(f) if f.is_integer() and not isinstance(v, float) else f


def slider(min, max, step=None, value=None, *, label=None, unit=None):  # noqa: A002
    """Numeric slider. slider(min, max, step=None, value=None, label=..., unit=...)."""
    lo, hi = _num(min), _num(max)
    if hi < lo:
        lo, hi = hi, lo
    all_int = all(isinstance(x, int) and not isinstance(x, bool) for x in (min, max)) and (
        step is None or isinstance(step, int)
    ) and (value is None or isinstance(value, int))
    if step is None:
        step = 1 if all_int else (hi - lo) / 100 or 1
    step = abs(_num(step)) or 1
    spec = Control(type="slider", label=label, min=lo, max=hi, step=step)
    spec["value"] = _snap(spec, (lo + hi) / 2 if value is None else _num(value))
    if unit:
        spec["unit"] = str(unit)
    return spec


def select(options, value=None, *, label=None):
    """Choice between options (list of str/number, or dict {label: value} → labels are used)."""
    if isinstance(options, dict):
        options = list(options.keys())
    opts = []
    for o in list(options)[:MAX_OPTIONS]:
        if isinstance(o, bool) or not isinstance(o, (int, float, str)):
            o = str(o)
        opts.append(o)
    if not opts:
        raise ValueError("select() braucht mindestens eine Option")
    spec = Control(type="select", label=label, options=opts)
    spec["value"] = _pick(spec, opts[0] if value is None else value)
    return spec


def checkbox(value=False, *, label=None):
    """On/off switch."""
    return Control(type="checkbox", label=label, value=bool(value))


def _snap(spec, v):
    lo, hi, step = spec["min"], spec["max"], spec["step"]
    try:
        v = float(v)
    except (TypeError, ValueError):
        return spec.get("value", lo)
    if not math.isfinite(v):
        return spec.get("value", lo)
    v = min(hi, max(lo, v))
    v = lo + round((v - lo) / step) * step
    v = min(hi, max(lo, v))
    decimals = max(0, -int(math.floor(math.log10(step))) + 2) if step < 1 else 6
    v = round(v, decimals)
    if all(isinstance(x, int) for x in (lo, hi, step)):
        return int(round(v))
    return v


def _pick(spec, v):
    opts = spec["options"]
    if v in opts:
        return v
    for o in opts:
        if str(o) == str(v):
            return o
    return spec.get("value", opts[0])


def _as_control(name, c):
    """Accept explicit controls plus shortcuts: (min, max[, step[, value]]) → slider,
    list → select, bool → checkbox."""
    if isinstance(c, Control):
        spec = Control(c)
    elif isinstance(c, bool):
        spec = checkbox(c)
    elif isinstance(c, tuple) and 2 <= len(c) <= 4:
        spec = slider(*c)
    elif isinstance(c, (list, dict)):
        spec = select(c)
    else:
        raise TypeError(
            f"Ungültiges Steuerelement für '{name}': nutze slider(...), select([...]) oder checkbox(...)"
        )
    spec["name"] = name
    spec["label"] = str(spec.get("label") or name)
    return spec


def _validate(controls, values):
    out = {}
    values = values if isinstance(values, dict) else {}
    for c in controls:
        name = c["name"]
        v = values.get(name, c["value"])
        if c["type"] == "slider":
            out[name] = _snap(c, v)
        elif c["type"] == "select":
            out[name] = _pick(c, v)
        else:
            out[name] = v if isinstance(v, bool) else str(v).lower() in ("1", "true", "ja", "on")
    return out


def _publish(payload):
    from IPython.display import publish_display_data

    publish_display_data({WIDGET_MIME: payload, "text/plain": f"<blueChat-Widget {payload.get('id', '')}>"})


def _run(func, values):
    """Call func(**values); display a returned object; flush new matplotlib figures."""
    from IPython import get_ipython
    from IPython.display import display

    plt = None
    before = set()
    try:
        import matplotlib.pyplot as plt  # noqa: F811

        before = set(plt.get_fignums())
    except Exception:
        plt = None
    result = None
    try:
        result = func(**values)
    except Exception:
        ip = get_ipython()
        if ip is not None:
            ip.showtraceback()
        else:
            raise
    finally:
        if plt is not None:  # figures without plt.show() (inline backend would flush them too late)
            try:
                for num in plt.get_fignums():
                    fig = plt.figure(num)
                    if num in before or fig is result:
                        continue
                    if fig.get_axes():
                        display(fig)
                    plt.close(fig)
            except Exception:
                pass
    if result is not None:
        display(result)
        if plt is not None and hasattr(result, "number") and hasattr(result, "get_axes"):
            plt.close(result)


def interact(_func=None, *, title=None, **controls):
    """Decorator (or call `interact(func, title=..., x=slider(...))`) that shows an interactive
    widget: changing a control re-runs `func` with the new values."""

    def register(func):
        specs = [_as_control(name, c) for name, c in controls.items()]
        wid = uuid.uuid4().hex[:16]
        _REGISTRY[wid] = (func, specs)
        while len(_REGISTRY) > MAX_WIDGETS:
            _REGISTRY.popitem(last=False)
        public = [{k: v for k, v in s.items() if v is not None} for s in specs]
        _publish({"event": "start", "id": wid, "title": str(title) if title else None, "controls": public})
        try:
            _run(func, _validate(specs, {}))
        finally:
            _publish({"event": "end", "id": wid})
        return func

    if _func is not None and callable(_func):
        return register(_func)
    return register


def rerun(widget_id, values):
    """Called by the sandbox (POST /widget)."""
    entry = _REGISTRY.get(widget_id)
    if entry is None:
        _publish({"event": "missing", "id": widget_id, "message": NOT_ACTIVE_MSG})
        return
    _REGISTRY.move_to_end(widget_id)
    func, specs = entry
    _run(func, _validate(specs, values))


def install(ip) -> None:
    """Expose interact/slider/select/checkbox as builtins-like names in the user namespace."""
    ns = ip.user_ns
    ns["interact"] = interact
    ns["slider"] = slider
    ns["select"] = select
    ns["checkbox"] = checkbox
    hidden = getattr(ip, "user_ns_hidden", None)
    if isinstance(hidden, dict):  # keep them out of %who / namespace listings
        for k in ("interact", "slider", "select", "checkbox"):
            hidden[k] = ns[k]

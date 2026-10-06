FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HOME=/home/sandbox \
    MPLCONFIGDIR=/home/sandbox/.config/matplotlib \
    IPYTHONDIR=/home/sandbox/.ipython \
    JUPYTER_RUNTIME_DIR=/home/sandbox/.local/share/jupyter/runtime \
    WORKSPACE_DIR=/workspace

RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-dejavu-core fontconfig \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt && rm /tmp/requirements.txt

RUN useradd --create-home --home-dir /home/sandbox --uid 1000 --shell /bin/bash sandbox \
 && mkdir -p /workspace/sessions \
 && chown -R sandbox:sandbox /workspace

USER sandbox
# Warm the matplotlib font cache so the first plot is fast.
RUN mkdir -p "$MPLCONFIGDIR" "$IPYTHONDIR" "$JUPYTER_RUNTIME_DIR" \
 && python -c "import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt; plt.figure(); plt.close('all')"

WORKDIR /srv
COPY --chown=sandbox:sandbox app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-graceful-shutdown", "10"]

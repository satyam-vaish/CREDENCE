# ---------- builder ----------
FROM python:3.11-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---------- runtime ----------
FROM python:3.11-slim
RUN useradd -m -u 1000 app
COPY --from=builder /install /usr/local
WORKDIR /app
COPY . .
ENV PYTHONPATH=/app/src:/app \
    MODEL_DIR=/app/models/registry/credit-default-model
RUN chown -R app:app /app
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c \
  "import urllib.request as u; u.urlopen('http://localhost:8000/health')"
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

PY ?= python3

.PHONY: setup train serve demo test lint frontend-dev frontend-build clean

setup:
	$(PY) -m venv .venv && . .venv/bin/activate && pip install -U pip && pip install -r requirements.txt && pip install -e . && pre-commit install
	$(PY) scripts/download_data.py

train:
	$(PY) -m credence.train

serve:
	uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload

demo:
	docker compose up --build

test:
	pytest

lint:
	ruff check src backend tests scripts
	black --check src backend tests scripts

frontend-dev:
	cd frontend && npm install && npm run dev

frontend-build:
	cd frontend && npm ci && npm run build

clean:
	rm -rf .venv mlruns models/artifacts data/raw

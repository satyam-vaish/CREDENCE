import time

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tiny_bundle, monkeypatch):
    monkeypatch.setenv("MODEL_DIR", str(tiny_bundle))
    from backend.app.main import app, state

    assert state.load(), "test bundle failed to load"
    return TestClient(app)


BASE = {
    "annual_inc": 65000,
    "dti": 22,
    "int_rate": 14.5,
    "loan_amnt": 12000,
    "revol_util": 41,
    "delinq_2yrs": 1,
    "emp_length": 4,
    "grade": "C",
    "term": 36,
    "credit_age": 7,
    "home_ownership": "RENT",
    "purpose": "debt_consolidation",
}


def test_health_contract(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert {"status", "model_version", "uptime_s", "fallback"} <= set(body)


def test_predict_contract(client):
    r = client.post("/predict", json=BASE)
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"default_probability", "decision", "threshold", "model_version"}
    assert 0.0 <= body["default_probability"] <= 1.0
    assert body["decision"] in {"APPROVE", "REJECT"}


def test_predict_validates_input(client):
    r = client.post("/predict", json={"dti": 999})
    assert r.status_code == 422  # pydantic rejects out-of-range input


def test_whatif_moves_probability_and_is_fast(client):
    t0 = time.perf_counter()
    r = client.post("/whatif", json={"base": BASE, "feature": "dti", "value": 38})
    dt_ms = (time.perf_counter() - t0) * 1000
    assert r.status_code == 200
    body = r.json()
    assert dt_ms < 80, f"/whatif took {dt_ms:.1f}ms — budget is 80ms"
    assert body["delta"] != 0.0


def test_explain_top5(client):
    payload = {**BASE, "dti": 31, "int_rate": 18.9, "grade": "E", "term": 60}
    r = client.post("/explain", json=payload)
    assert r.status_code == 200
    contribs = r.json()["contributions"]
    assert len(contribs) == 5
    assert all("feature" in c and "contribution" in c for c in contribs)


def test_drift_and_simulate(client):
    r = client.post("/simulate?month=46")
    assert r.status_code == 200
    body = r.json()
    assert 0.0 <= body["drifted_share"] <= 1.0
    assert "per_feature" in body and "histograms" in body
    d = client.get("/drift")
    assert d.status_code == 200


def test_quiz_generated_from_model(client):
    client.post("/simulate?month=40")  # populate drift state so Q1 appears
    r = client.get("/quiz")
    assert r.status_code == 200
    qs = r.json()["questions"]
    assert len(qs) >= 4
    for item in qs:
        assert 0 <= item["answer"] < len(item["options"])
        assert item["explanation"]


def test_model_info(client):
    r = client.get("/model-info")
    assert r.status_code == 200
    data = r.json()
    assert "best_model" in data
    assert "threshold" in data


def test_metrics_endpoint(client):
    r = client.get("/metrics")
    assert r.status_code == 200
    assert "credence_requests_total" in r.text


def test_plots_endpoints(client):
    r = client.get("/plots/roc")
    # may be 200 or 404 depending on whether plot artifact exists
    assert r.status_code in (200, 404)

    r_invalid = client.get("/plots/nonexistent")
    assert r_invalid.status_code == 404


def test_whatif_unknown_feature(client):
    r = client.post("/whatif", json={"base": BASE, "feature": "not_a_feature", "value": 10})
    assert r.status_code == 422


def test_retrain_endpoint(client):
    r = client.post("/retrain")
    assert r.status_code == 200
    body = r.json()
    assert "new_version" in body
    assert "promoted" in body


def test_fallback_mode():
    from backend.app.main import app, state

    old_bundle = state.bundle
    old_meta = state.meta
    try:
        state.bundle = None
        state.meta = None
        c = TestClient(app)

        # Health degraded
        hr = c.get("/health")
        assert hr.status_code == 200
        assert hr.json()["status"] == "degraded:fallback"

        # Predict fallback
        pr = c.post("/predict", json=BASE)
        assert pr.status_code == 200
        assert 0.0 <= pr.json()["default_probability"] <= 1.0

        # Model info 503
        mr = c.get("/model-info")
        assert mr.status_code == 503

        # Explain 503
        er = c.post("/explain", json=BASE)
        assert er.status_code == 503

        # Quiz 503
        qr = c.get("/quiz")
        assert qr.status_code == 503

        # Retrain 503
        rr = c.post("/retrain")
        assert rr.status_code == 503
    finally:
        state.bundle = old_bundle
        state.meta = old_meta

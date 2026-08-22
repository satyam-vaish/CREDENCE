from credence.config import load_config
from credence.train import _save_plot, train


def test_save_plot(tmp_path, monkeypatch):
    import credence.train as tr

    monkeypatch.setattr(tr, "MODELS_DIR", tmp_path)
    (tmp_path / "artifacts").mkdir(parents=True, exist_ok=True)
    _save_plot("test_plot")
    assert (tmp_path / "artifacts" / "test_plot.png").exists()


def test_train_smoke(tmp_path, monkeypatch):
    import credence.train as tr

    monkeypatch.setattr(tr, "MODELS_DIR", tmp_path)
    (tmp_path / "artifacts").mkdir(parents=True, exist_ok=True)

    cfg = load_config()
    cfg["optuna"]["n_trials"] = 1
    cfg["optuna"]["seed"] = 42

    meta = train(cfg=cfg, n_trials_override=1)
    assert "best_model" in meta
    assert (tmp_path / "bundle.joblib").exists()
    assert (tmp_path / "meta.json").exists()


def test_retrain_script(monkeypatch):
    import scripts.retrain as rscript

    # Without trigger flag
    rscript.main()

    # With --force
    monkeypatch.setattr("sys.argv", ["retrain.py", "--force"])
    rscript.main()

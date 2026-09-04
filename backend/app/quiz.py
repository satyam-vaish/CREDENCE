"""Quiz questions generated from the model's OWN artifacts (meta.json) and the
live drift state — not a static list. Correct-answer indices are set AFTER
shuffling so the key is always consistent with the emitted options."""

from __future__ import annotations

import random


def build_quiz(meta: dict, drift: dict) -> list[dict]:
    rng = random.Random(int(meta.get("trained_at", 0)) // 86400)  # stable per day
    q: list[dict] = []

    def mq(question: str, options: list[str], answer_idx: int, explanation: str, tag: str) -> dict:
        correct = options[answer_idx]
        rng.shuffle(options)
        return {
            "question": question,
            "options": options,
            "answer": options.index(correct),
            "explanation": explanation,
            "tag": tag,
        }

    # 1 — from live PSI
    pf = drift.get("per_feature", {})
    if pf:
        ranked = sorted(pf.items(), key=lambda kv: -kv[1]["psi"])
        answer_feat = ranked[0][0]
        others = [f for f, _ in ranked[1:5]] or ["loan_amnt"]
        q.append(
            mq(
                "Which feature currently shows the strongest drift signal?",
                [answer_feat] + others[:3],
                0,
                f"PSI({answer_feat}) = {ranked[0][1]['psi']:.3f} "
                f"({ranked[0][1]['band']}) — highest of all monitored features.",
                "DRIFT",
            )
        )

    # 2 — from validation metrics
    auc = meta["metrics"]["val"]["roc_auc"]
    correct = f"{round(auc, 2):.2f}"
    opts = sorted({correct, f"{auc + 0.07:.2f}", f"{max(auc - 0.08, 0.5):.2f}", "0.95"})
    q.append(
        mq(
            "The production model's validation ROC-AUC is closest to...",
            opts,
            opts.index(correct),
            f"Validation ROC-AUC = {auc:.4f} (Gini = {2 * auc - 1:.3f}).",
            "MODEL",
        )
    )

    q.append(
        mq(
            "If we LOWER the decision threshold, what happens?",
            [
                "Precision rises and recall falls",
                "Precision falls and recall rises",
                "Both precision and recall rise",
                "Nothing — the threshold only affects latency",
            ],
            1,
            f"Lower threshold -> more applicants flagged risky -> recall up, "
            f"precision down. Current threshold: {meta['threshold']:.3f}.",
            "THRESHOLD",
        )
    )

    q.append(
        mq(
            "Which metric can look healthy under heavy class imbalance "
            "even for a useless model?",
            ["ROC-AUC", "PR-AUC", "Brier score", "KS statistic"],
            0,
            "With ~13% defaults, true negatives dominate ROC-AUC. PR-AUC, "
            "Brier and KS all degrade visibly with a useless model.",
            "METRICS",
        )
    )

    q.append(
        mq(
            "A feature's PSI jumps to 0.31 between training and today. That means...",
            [
                "The feature is stable",
                "Moderate drift — watch it",
                "Significant drift — the model is extrapolating",
                "The feature must be removed",
            ],
            2,
            "PSI bands: <0.1 stable, 0.1-0.25 moderate, >0.25 significant.",
            "DRIFT",
        )
    )

    q.append(
        mq(
            "The KS statistic measures...",
            [
                "The average prediction error",
                "The maximum gap between the cumulative good/bad distributions",
                "The slope of the ROC curve at 0.5",
                "The share of drifted features",
            ],
            1,
            "KS = max|TPR - FPR| — the point of best population separation.",
            "METRICS",
        )
    )

    return q

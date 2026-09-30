"""Pruebas estadísticas inferenciales robustas (CRISP-DM — Evaluación)."""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats


def compare_models_friedman(cv_results: pd.DataFrame) -> dict[str, float | str]:
    """Friedman sobre MAE por fold — ¿difieren los modelos?"""
    pivot = cv_results.pivot(index="fold", columns="model", values="mae").dropna(axis=1)
    if pivot.shape[1] < 3:
        return {"test": "Friedman", "statistic": np.nan, "p_value": np.nan, "interpretation": "Insuficientes modelos"}
    stat, p = stats.friedmanchisquare(*[pivot[col].values for col in pivot.columns])
    interp = "Rechaza H0: al menos un modelo difiere en MAE" if p < 0.05 else "No hay evidencia de diferencias globales"
    return {"test": "Friedman", "statistic": round(stat, 4), "p_value": round(p, 6), "interpretation": interp}


def pairwise_wilcoxon(cv_results: pd.DataFrame, model_a: str, model_b: str) -> dict[str, float | str]:
    """Wilcoxon pareado entre dos modelos (robusto a no normalidad)."""
    a = cv_results[cv_results["model"] == model_a].sort_values("fold")["mae"].values
    b = cv_results[cv_results["model"] == model_b].sort_values("fold")["mae"].values
    n = min(len(a), len(b))
    if n < 3:
        return {"test": "Wilcoxon", "models": f"{model_a} vs {model_b}", "p_value": np.nan, "interpretation": "Muy pocos folds"}
    stat, p = stats.wilcoxon(a[:n], b[:n])
    better = model_a if np.mean(a[:n]) < np.mean(b[:n]) else model_b
    interp = f"{'Significativo' if p < 0.05 else 'No significativo'}; menor MAE: {better}"
    return {
        "test": "Wilcoxon signed-rank",
        "models": f"{model_a} vs {model_b}",
        "statistic": round(float(stat), 4),
        "p_value": round(float(p), 6),
        "interpretation": interp,
    }


def bootstrap_mae_ci(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    n_bootstrap: int = 2000,
    alpha: float = 0.05,
    seed: int = 42,
) -> dict[str, float]:
    rng = np.random.default_rng(seed)
    n = len(y_true)
    boot = []
    for _ in range(n_bootstrap):
        idx = rng.integers(0, n, n)
        boot.append(float(np.mean(np.abs(y_true[idx] - y_pred[idx]))))
    low, high = np.percentile(boot, [100 * alpha / 2, 100 * (1 - alpha / 2)])
    return {"mae": float(np.mean(np.abs(y_true - y_pred))), "ci_low": float(low), "ci_high": float(high)}


def residual_diagnostics(y_true: np.ndarray, y_pred: np.ndarray) -> pd.DataFrame:
    residuals = y_true - y_pred
    stat_sw, p_sw = stats.shapiro(residuals[: min(len(residuals), 5000)])
    stat_dw = _durbin_watson(residuals)
    return pd.DataFrame([
        {"test": "Shapiro-Wilk (normalidad residuos)", "statistic": round(stat_sw, 4), "p_value": round(p_sw, 6),
         "interpretation": "Residuos no normales" if p_sw < 0.05 else "No se rechaza normalidad"},
        {"test": "Durbin-Watson (autocorrelación)", "statistic": round(stat_dw, 4), "p_value": np.nan,
         "interpretation": "Posible autocorrelación" if stat_dw < 1.5 or stat_dw > 2.5 else "Autocorrelación leve"},
    ])


def _durbin_watson(residuals: np.ndarray) -> float:
    diff = np.diff(residuals)
    return float(np.sum(diff ** 2) / np.sum(residuals ** 2))


def run_all_inferential_tests(cv_results: pd.DataFrame, best_model: str, baseline: str = "Seasonal Naïve (t-12)") -> pd.DataFrame:
    rows = []
    friedman = compare_models_friedman(cv_results)
    rows.append({"test": friedman["test"], "comparison": "Todos los modelos", "statistic": friedman["statistic"],
                 "p_value": friedman["p_value"], "interpretation": friedman["interpretation"]})
    if best_model != baseline:
        w = pairwise_wilcoxon(cv_results, best_model, baseline)
        rows.append({"test": w["test"], "comparison": w["models"], "statistic": w.get("statistic"),
                     "p_value": w["p_value"], "interpretation": w["interpretation"]})
    return pd.DataFrame(rows)

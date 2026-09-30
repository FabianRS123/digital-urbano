"""Entrenamiento, validación cruzada e hiperparámetros (CRISP-DM — Modelado)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.base import clone
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .config import RANDOM_STATE, TARGET_COL, GROUP_COL
from .data_loader import seasonal_naive_predict


@dataclass
class ModelSpec:
    name: str
    estimator: Any
    param_grid: dict[str, list[Any]] = field(default_factory=dict)


def mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    mask = y_true != 0
    if not mask.any():
        return float("nan")
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


def evaluate_predictions(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "mape": mape(y_true, y_pred),
        "r2": float(r2_score(y_true, y_pred)),
    }


def get_model_catalog() -> list[ModelSpec]:
    return [
        ModelSpec(
            name="Seasonal Naïve (t-12)",
            estimator=None,
            param_grid={},
        ),
        ModelSpec(
            name="Ridge (L2)",
            estimator=Pipeline([
                ("scaler", StandardScaler()),
                ("model", Ridge(random_state=RANDOM_STATE)),
            ]),
            param_grid={"model__alpha": [0.1, 1.0, 10.0, 100.0]},
        ),
        ModelSpec(
            name="Random Forest",
            estimator=RandomForestRegressor(random_state=RANDOM_STATE, n_jobs=-1),
            param_grid={
                "n_estimators": [100, 200],
                "max_depth": [4, 6, None],
                "min_samples_leaf": [1, 3],
            },
        ),
        ModelSpec(
            name="Gradient Boosting",
            estimator=GradientBoostingRegressor(random_state=RANDOM_STATE),
            param_grid={
                "n_estimators": [100, 200],
                "learning_rate": [0.05, 0.1],
                "max_depth": [2, 3],
            },
        ),
    ]


def time_series_cv(n_splits: int = 5) -> TimeSeriesSplit:
    return TimeSeriesSplit(n_splits=n_splits)


def run_baseline(modeling: pd.DataFrame, raw: pd.DataFrame, cv: TimeSeriesSplit) -> pd.DataFrame:
    """Validación cruzada temporal para Seasonal Naïve."""
    rows = []
    X = modeling.sort_values("month")
    for fold, (train_idx, test_idx) in enumerate(cv.split(X)):
        test = X.iloc[test_idx]
        history = raw[raw["month"].isin(X.iloc[train_idx]["month"])]
        y_true = test[TARGET_COL].values
        y_pred = np.array([seasonal_naive_predict(row, history) for _, row in test.iterrows()])
        metrics = evaluate_predictions(y_true, y_pred)
        rows.append({"model": "Seasonal Naïve (t-12)", "fold": fold + 1, **metrics})
    return pd.DataFrame(rows)


def run_cross_validation(
    modeling: pd.DataFrame,
    feature_cols: list[str],
    n_splits: int = 5,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """CV temporal para modelos sklearn."""
    cv = time_series_cv(n_splits)
    catalog = [m for m in get_model_catalog() if m.name != "Seasonal Naïve (t-12)"]
    cv_rows: list[dict[str, Any]] = []
    summary_rows: list[dict[str, Any]] = []

    sorted_df = modeling.sort_values("month").reset_index(drop=True)
    X_all = sorted_df[feature_cols]
    y_all = sorted_df[TARGET_COL].values

    for spec in catalog:
        fold_metrics = []
        for fold, (train_idx, test_idx) in enumerate(cv.split(sorted_df)):
            X_train, X_test = X_all.iloc[train_idx], X_all.iloc[test_idx]
            y_train, y_test = y_all[train_idx], y_all[test_idx]
            model = clone(spec.estimator)
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            metrics = evaluate_predictions(y_test, y_pred)
            cv_rows.append({"model": spec.name, "fold": fold + 1, **metrics})
            fold_metrics.append(metrics)

        summary_rows.append({
            "model": spec.name,
            "mae_mean": np.mean([m["mae"] for m in fold_metrics]),
            "mae_std": np.std([m["mae"] for m in fold_metrics]),
            "rmse_mean": np.mean([m["rmse"] for m in fold_metrics]),
            "mape_mean": np.mean([m["mape"] for m in fold_metrics]),
            "r2_mean": np.mean([m["r2"] for m in fold_metrics]),
        })

    return pd.DataFrame(cv_rows), pd.DataFrame(summary_rows).sort_values("mae_mean")


def tune_hyperparameters(
    modeling: pd.DataFrame,
    feature_cols: list[str],
    model_name: str,
    n_splits: int = 5,
) -> tuple[Any, pd.DataFrame, dict[str, float]]:
    """GridSearchCV con validación cruzada temporal."""
    catalog = {m.name: m for m in get_model_catalog()}
    if model_name not in catalog or model_name == "Seasonal Naïve (t-12)":
        raise ValueError(f"Modelo no tunable: {model_name}")

    spec = catalog[model_name]
    sorted_df = modeling.sort_values("month").reset_index(drop=True)
    X = sorted_df[feature_cols]
    y = sorted_df[TARGET_COL].values
    cv = time_series_cv(n_splits)

    search = GridSearchCV(
        spec.estimator,
        spec.param_grid,
        cv=cv,
        scoring="neg_mean_absolute_error",
        n_jobs=-1,
        refit=True,
    )
    search.fit(X, y)
    best_metrics = evaluate_predictions(y, search.predict(X))
    results_df = pd.DataFrame(search.cv_results_).sort_values("rank_test_score")
    keep = [c for c in results_df.columns if c.startswith("param_") or c in ("mean_test_score", "std_test_score", "rank_test_score")]
    return search.best_estimator_, results_df[keep].head(10), {
        "best_params": search.best_params_,
        **best_metrics,
    }


def train_final_model(
    modeling: pd.DataFrame,
    feature_cols: list[str],
    model_name: str,
    tuned_estimator: Any | None = None,
) -> tuple[Any, pd.DataFrame]:
    """Entrena el mejor modelo sobre todo el panel y devuelve importancias."""
    X = modeling[feature_cols]
    y = modeling[TARGET_COL].values

    if model_name == "Seasonal Naïve (t-12)":
        return None, pd.DataFrame()

    if tuned_estimator is not None:
        model = tuned_estimator
    else:
        catalog = {m.name: m for m in get_model_catalog()}
        model = catalog[model_name].estimator

    model.fit(X, y)
    importances = pd.DataFrame({"feature": feature_cols, "importance": np.zeros(len(feature_cols))})

    if hasattr(model, "named_steps") and hasattr(model.named_steps.get("model"), "coef_"):
        coef = model.named_steps["model"].coef_
        importances["importance"] = np.abs(coef)
    elif hasattr(model, "feature_importances_"):
        importances["importance"] = model.feature_importances_
    elif hasattr(model, "named_steps") and hasattr(model[-1], "feature_importances_"):
        importances["importance"] = model[-1].feature_importances_

    importances = importances.sort_values("importance", ascending=False).reset_index(drop=True)
    return model, importances


def select_best_model(cv_summary: pd.DataFrame, baseline_summary: pd.DataFrame | None = None) -> str:
    frames = [cv_summary]
    if baseline_summary is not None and len(baseline_summary):
        frames.append(baseline_summary)
    combined = pd.concat(frames, ignore_index=True)
    return str(combined.sort_values("mae_mean").iloc[0]["model"])

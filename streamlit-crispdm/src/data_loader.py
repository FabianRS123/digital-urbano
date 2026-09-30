"""Carga y transformación del snapshot oficial del gemelo digital."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .config import SNAPSHOT_PATH


def load_snapshot(path: Path | None = None) -> dict[str, Any]:
    snapshot_path = path or SNAPSHOT_PATH
    if not snapshot_path.exists():
        raise FileNotFoundError(
            f"No se encontró {snapshot_path}. Ejecute primero `pnpm data:sync` en la raíz del proyecto."
        )
    with snapshot_path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _poverty_rate(interval: list[float]) -> float:
    return (interval[0] + interval[1]) / 200.0


def _facility_counts(snapshot: dict[str, Any]) -> pd.DataFrame:
    rows = []
    for facility in snapshot["facilities"]:
        rows.append(
            {
                "district_id": facility["districtId"],
                "district_code": facility.get("districtCode") or facility.get("code", "")[:6],
                "operational": facility.get("operationalStatus") == "Operativo",
                "category": facility.get("category"),
            }
        )
    df = pd.DataFrame(rows)
    agg = (
        df[df["operational"]]
        .groupby("district_id")
        .agg(
            facilities_operational=("category", "count"),
            categories=("category", lambda x: x.nunique()),
        )
        .reset_index()
    )
    return agg


def build_district_monthly(snapshot: dict[str, Any]) -> pd.DataFrame:
    """Panel distrital-mensual con demanda SIS y covariables INEI/RENIPRESS."""
    months = sorted(snapshot["months"])
    facility_agg = _facility_counts(snapshot)
    rows: list[dict[str, Any]] = []

    for district in snapshot["districts"]:
        history = district["history"]
        pop_2025 = district["populationByYear"].get("2025") or district["populationByYear"].get("2024")
        poverty = _poverty_rate(district["povertyInterval"])
        fac = facility_agg[facility_agg["district_id"] == district["id"]]
        n_fac = int(fac["facilities_operational"].iloc[0]) if len(fac) else 0

        for month in months:
            demand = history.get(month)
            if demand is None:
                continue
            year, mon = map(int, month.split("-"))
            rows.append(
                {
                    "district_id": district["id"],
                    "district_code": district["code"],
                    "district_name": district["name"],
                    "month": month,
                    "year": year,
                    "month_num": mon,
                    "demand": demand,
                    "population": pop_2025,
                    "poverty_rate": poverty,
                    "area_km2": district["areaKm2"],
                    "facilities_operational": n_fac,
                    "density": pop_2025 / district["areaKm2"],
                    "demand_per_10k": demand * 10000 / pop_2025,
                }
            )

    df = pd.DataFrame(rows).sort_values(["district_code", "month"]).reset_index(drop=True)
    return df


def add_lag_features(df: pd.DataFrame, lags: tuple[int, ...] = (1, 3, 6, 12)) -> pd.DataFrame:
    out = df.copy()
    for lag in lags:
        out[f"lag_{lag}"] = out.groupby("district_code")["demand"].shift(lag)
    out["month_sin"] = np.sin(2 * np.pi * out["month_num"] / 12)
    out["month_cos"] = np.cos(2 * np.pi * out["month_num"] / 12)
    out["log_population"] = np.log1p(out["population"])
    return out


def build_modeling_table(snapshot: dict[str, Any] | None = None) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, Any]]:
    snap = snapshot or load_snapshot()
    raw = build_district_monthly(snap)
    featured = add_lag_features(raw)
    feature_cols = [
        "lag_1", "lag_3", "lag_6", "lag_12",
        "poverty_rate", "population", "log_population", "density",
        "facilities_operational", "month_sin", "month_cos",
    ]
    modeling = featured.dropna(subset=feature_cols + ["demand"]).reset_index(drop=True)
    meta = {
        "version": snap.get("version"),
        "created_at": snap.get("createdAt"),
        "months": snap.get("months"),
        "sources": snap.get("sources", []),
        "n_districts": raw["district_code"].nunique(),
        "n_rows_raw": len(raw),
        "n_rows_modeling": len(modeling),
        "feature_cols": feature_cols,
    }
    return raw, modeling, meta


def seasonal_naive_predict(row: pd.Series, history: pd.DataFrame) -> float:
    """Persistencia t-12: mismo mes del año anterior."""
    district = row["district_code"]
    month = row["month"]
    prev_year = f"{int(month[:4]) - 1}{month[4:]}"
    match = history[(history["district_code"] == district) & (history["month"] == prev_year)]
    if len(match):
        return float(match["demand"].iloc[0])
    district_hist = history[history["district_code"] == district].sort_values("month")
    return float(district_hist["demand"].iloc[-1]) if len(district_hist) else float(row["demand"])

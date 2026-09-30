"""Análisis exploratorio de datos (CRISP-DM — Comprensión)."""

from __future__ import annotations

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import seaborn as sns
from scipy import stats


def summary_statistics(df: pd.DataFrame) -> pd.DataFrame:
    numeric = df.select_dtypes(include=[np.number])
    desc = numeric.describe().T
    desc["cv"] = desc["std"] / desc["mean"]
    desc["skew"] = numeric.skew()
    desc["kurtosis"] = numeric.kurtosis()
    return desc.round(4)


def missing_report(df: pd.DataFrame) -> pd.DataFrame:
    report = pd.DataFrame(
        {
            "columna": df.columns,
            "nulos": df.isna().sum().values,
            "pct_nulos": (df.isna().mean() * 100).round(2).values,
        }
    )
    return report.sort_values("pct_nulos", ascending=False)


def correlation_matrix(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    return df[cols].corr(method="pearson").round(4)


def plot_demand_timeseries(raw: pd.DataFrame) -> go.Figure:
    fig = px.line(
        raw,
        x="month",
        y="demand",
        color="district_name",
        markers=True,
        title="Serie temporal de atenciones SIS por distrito (Área Metropolitana de Trujillo)",
        labels={"demand": "Atenciones mensuales", "month": "Mes"},
    )
    fig.update_layout(legend_title_text="Distrito", hovermode="x unified")
    return fig


def plot_demand_boxplot(raw: pd.DataFrame) -> go.Figure:
    fig = px.box(
        raw,
        x="district_name",
        y="demand",
        color="district_name",
        title="Distribución de demanda SIS por distrito",
        labels={"demand": "Atenciones", "district_name": "Distrito"},
    )
    fig.update_layout(showlegend=False, xaxis_tickangle=-35)
    return fig


def plot_poverty_vs_demand(raw: pd.DataFrame) -> go.Figure:
    agg = raw.groupby("district_name").agg(
        demand_mean=("demand", "mean"),
        poverty_rate=("poverty_rate", "first"),
        population=("population", "first"),
    ).reset_index()
    fig = px.scatter(
        agg,
        x="poverty_rate",
        y="demand_mean",
        size="population",
        hover_name="district_name",
        title="Pobreza distrital (INEI) vs demanda SIS promedio",
        labels={"poverty_rate": "Tasa de pobreza", "demand_mean": "Demanda media mensual"},
    )
    return fig


def plot_correlation_heatmap(corr: pd.DataFrame) -> plt.Figure:
    fig, ax = plt.subplots(figsize=(10, 7))
    sns.heatmap(corr, annot=True, fmt=".2f", cmap="RdBu_r", center=0, ax=ax)
    ax.set_title("Matriz de correlación — variables del panel distrital-mensual")
    fig.tight_layout()
    return fig


def normality_tests(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    rows = []
    for col in cols:
        values = df[col].dropna().values
        if len(values) < 8:
            continue
        stat, p = stats.shapiro(values[:5000])
        rows.append({"variable": col, "test": "Shapiro-Wilk", "statistic": round(stat, 4), "p_value": round(p, 6)})
    return pd.DataFrame(rows)

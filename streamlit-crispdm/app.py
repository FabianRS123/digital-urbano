"""
Gemelo Digital Urbano de Salud — Trujillo
Motor CRISP-DM en Streamlit (Python)

Metodología: Comprensión → EDA → Modelado → Evaluación → Despliegue
Dataset: official-snapshot.json (SIS + INEI + RENIPRESS + límites)
"""

from __future__ import annotations

import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import plotly.express as px
import streamlit as st
from sklearn.base import clone

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.config import FOOTNOTE, SNAPSHOT_PATH
from src.data_loader import build_modeling_table, load_snapshot
from src.eda import (
    correlation_matrix,
    missing_report,
    normality_tests,
    plot_correlation_heatmap,
    plot_demand_boxplot,
    plot_demand_timeseries,
    plot_poverty_vs_demand,
    summary_statistics,
)
from src.models import (
    get_model_catalog,
    run_baseline,
    run_cross_validation,
    select_best_model,
    time_series_cv,
    train_final_model,
    tune_hyperparameters,
)
from src.pdf_report import build_pdf_report, save_pdf_report
from src.reports import build_markdown_report, save_report
from src.stats_tests import bootstrap_mae_ci, residual_diagnostics, run_all_inferential_tests
from src.ui_helpers import render_footnote, render_sources, render_table

st.set_page_config(
    page_title="CRISP-DM | GDUS Trujillo",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("Gemelo Digital Urbano de Salud — Trujillo")
st.subheader("Motor Python CRISP-DM · Streamlit")
st.markdown(
    "Pipeline de ciencia de datos sobre **datos públicos reales** del Área Metropolitana de Trujillo "
    "(SIS, INEI, RENIPRESS). Metodología **CRISP-DM**."
)


@st.cache_data(show_spinner="Cargando snapshot oficial…")
def load_data():
    snapshot = load_snapshot()
    raw, modeling, meta = build_modeling_table(snapshot)
    return snapshot, raw, modeling, meta


try:
    snapshot, raw, modeling, meta = load_data()
except FileNotFoundError as exc:
    st.error(str(exc))
    st.stop()

# Sidebar — fases CRISP-DM
st.sidebar.header("Fases CRISP-DM")
phase = st.sidebar.radio(
    "Seleccione fase",
    [
        "0. Contexto y datos",
        "1. EDA",
        "2. Entrenamiento",
        "3. Selección del mejor modelo",
        "4. Validación cruzada",
        "5. Hiperparámetros",
        "6. Pruebas estadísticas",
        "7. Reportes",
    ],
)
st.sidebar.markdown("---")
st.sidebar.metric("Distritos", meta["n_districts"])
st.sidebar.metric("Meses SIS", len(meta["months"]))
st.sidebar.metric("Filas modelado", meta["n_rows_modeling"])
st.sidebar.caption(f"Snapshot: `{meta['version']}`")

feature_cols = meta["feature_cols"]
n_splits = st.sidebar.slider("Folds CV temporal", 3, 8, 5)

# ---------------------------------------------------------------------------
# 0. Contexto
# ---------------------------------------------------------------------------
if phase.startswith("0"):
    st.header("0. Comprensión del negocio y datos (CRISP-DM)")
    st.markdown(
        "**Objetivo de negocio:** predecir la demanda mensual de atenciones SIS por distrito "
        "para identificar zonas con riesgo de saturación asistencial."
    )
    render_sources()
    st.markdown("#### Metodología CRISP-DM aplicada")
    crisp = pd.DataFrame([
        {"Fase": "Comprensión del negocio", "Entregable": "Objetivo predictivo distrital SIS"},
        {"Fase": "Comprensión de datos", "Entregable": "Snapshot oficial + panel mensual"},
        {"Fase": "Preparación", "Entregable": "Lags t-1,t-3,t-6,t-12 + SDOH + IPRESS"},
        {"Fase": "Modelado", "Entregable": "Ridge, RF, GBM vs Naïve estacional"},
        {"Fase": "Evaluación", "Entregable": "CV temporal + pruebas inferenciales"},
        {"Fase": "Despliegue", "Entregable": "Reportes y recomendaciones interpretables"},
    ])
    render_table(crisp)
    st.markdown("#### Vista previa del panel distrital-mensual")
    render_table(raw.head(20))

# ---------------------------------------------------------------------------
# 1. EDA
# ---------------------------------------------------------------------------
elif phase.startswith("1"):
    st.header("1. Análisis Exploratorio de Datos (EDA)")
    tab1, tab2, tab3, tab4 = st.tabs(["Estadísticos", "Series temporales", "Correlaciones", "Normalidad"])

    with tab1:
        summary = summary_statistics(raw)
        render_table(summary)
        miss = missing_report(modeling)
        render_table(miss)

    with tab2:
        fig_ts = plot_demand_timeseries(raw)
        st.plotly_chart(fig_ts, use_container_width=True)
        render_footnote()
        fig_box = plot_demand_boxplot(raw)
        st.plotly_chart(fig_box, use_container_width=True)
        render_footnote()
        fig_pov = plot_poverty_vs_demand(raw)
        st.plotly_chart(fig_pov, use_container_width=True)
        render_footnote()

    with tab3:
        cols = ["demand", "poverty_rate", "population", "facilities_operational", "demand_per_10k"]
        corr = correlation_matrix(raw, cols)
        render_table(corr)
        fig_hm = plot_correlation_heatmap(corr)
        st.pyplot(fig_hm)
        render_footnote()
        plt.close(fig_hm)

    with tab4:
        norm = normality_tests(raw, ["demand", "poverty_rate", "demand_per_10k"])
        render_table(norm)

# ---------------------------------------------------------------------------
# 2. Entrenamiento
# ---------------------------------------------------------------------------
elif phase.startswith("2"):
    st.header("2. Entrenamiento de modelos")
    st.markdown(
        f"**Variable objetivo:** `demand` (atenciones SIS mensuales). "
        f"**Features:** {', '.join(feature_cols)}"
    )
    catalog = get_model_catalog()
    render_table(pd.DataFrame([{"Modelo": m.name, "Hiperparámetros": str(m.param_grid) or "Baseline t-12"} for m in catalog]))

    if st.button("Ejecutar entrenamiento completo", type="primary"):
        with st.spinner("Entrenando modelos…"):
            cv = time_series_cv(n_splits)
            baseline_cv = run_baseline(modeling, raw, cv)
            ml_cv, ml_summary = run_cross_validation(modeling, feature_cols, n_splits)
            baseline_summary = pd.DataFrame([{
                "model": "Seasonal Naïve (t-12)",
                "mae_mean": baseline_cv["mae"].mean(),
                "mae_std": baseline_cv["mae"].std(),
                "rmse_mean": baseline_cv["rmse"].mean(),
                "mape_mean": baseline_cv["mape"].mean(),
                "r2_mean": baseline_cv["r2"].mean(),
            }])
            full_cv = pd.concat([baseline_cv, ml_cv], ignore_index=True)
            full_summary = pd.concat([baseline_summary, ml_summary], ignore_index=True).sort_values("mae_mean")
            best = select_best_model(ml_summary, baseline_summary)
            st.session_state["cv_results"] = full_cv
            st.session_state["cv_summary"] = full_summary
            st.session_state["best_model"] = best
        st.success(f"Entrenamiento completado. Mejor modelo preliminar: **{best}**")

    if "cv_summary" in st.session_state:
        render_table(st.session_state["cv_summary"].round(4))
        fig = px.bar(
            st.session_state["cv_summary"],
            x="model", y="mae_mean", error_y="mae_std",
            title="MAE promedio por modelo (CV temporal)",
            labels={"mae_mean": "MAE", "model": "Modelo"},
        )
        st.plotly_chart(fig, use_container_width=True)
        render_footnote()

# ---------------------------------------------------------------------------
# 3. Selección
# ---------------------------------------------------------------------------
elif phase.startswith("3"):
    st.header("3. Selección del mejor modelo")
    if "cv_summary" not in st.session_state:
        st.warning("Ejecute primero el entrenamiento en la fase 2.")
    else:
        summary = st.session_state["cv_summary"]
        best = st.session_state["best_model"]
        st.success(f"**Modelo seleccionado (menor MAE en CV):** {best}")
        render_table(summary.round(4))

        criteria = pd.DataFrame([
            {"Criterio": "MAE (principal)", "Ganador": summary.sort_values("mae_mean").iloc[0]["model"]},
            {"Criterio": "RMSE", "Ganador": summary.sort_values("rmse_mean").iloc[0]["model"]},
            {"Criterio": "MAPE", "Ganador": summary.sort_values("mape_mean").iloc[0]["model"]},
            {"Criterio": "R²", "Ganador": summary.sort_values("r2_mean", ascending=False).iloc[0]["model"]},
        ])
        render_table(criteria)
        st.markdown(
            "**Criterio de selección:** menor MAE promedio en validación cruzada temporal, "
            "priorizando generalización fuera de muestra sobre ajuste in-sample."
        )
        render_footnote()

# ---------------------------------------------------------------------------
# 4. CV
# ---------------------------------------------------------------------------
elif phase.startswith("4"):
    st.header("4. Validación cruzada")
    st.markdown(
        "Se usa **TimeSeriesSplit** para respetar el orden cronológico del panel SIS "
        "(2024-01 → 2025-12). No se mezclan meses futuros en entrenamiento."
    )
    if "cv_results" not in st.session_state:
        st.warning("Ejecute el entrenamiento en la fase 2.")
    else:
        cv_df = st.session_state["cv_results"]
        render_table(cv_df.round(4))
        fig = px.line(cv_df, x="fold", y="mae", color="model", markers=True,
                      title="MAE por fold — validación cruzada temporal")
        st.plotly_chart(fig, use_container_width=True)
        render_footnote()

        pivot = cv_df.pivot(index="fold", columns="model", values="mae")
        st.markdown("#### Tabla pivote MAE por fold")
        render_table(pivot.round(2))

# ---------------------------------------------------------------------------
# 5. Hiperparámetros
# ---------------------------------------------------------------------------
elif phase.startswith("5"):
    st.header("5. Optimización de hiperparámetros")
    tunable = [m.name for m in get_model_catalog() if m.name != "Seasonal Naïve (t-12)"]
    selected = st.selectbox("Modelo a optimizar (GridSearchCV)", tunable,
                            index=tunable.index(st.session_state.get("best_model", tunable[0]))
                            if st.session_state.get("best_model") in tunable else 0)

    if st.button("Ejecutar GridSearchCV", type="primary"):
        with st.spinner("Buscando hiperparámetros…"):
            best_est, grid_results, best_info = tune_hyperparameters(modeling, feature_cols, selected, n_splits)
            st.session_state["tuned_model"] = best_est
            st.session_state["tuned_name"] = selected
            st.session_state["tuned_params"] = best_info["best_params"]
            st.session_state["grid_results"] = grid_results
        st.success(f"Mejores hiperparámetros: `{best_info['best_params']}`")

    if "grid_results" in st.session_state:
        render_table(st.session_state["grid_results"].round(4))
        st.markdown(f"**Parámetros óptimos:** `{st.session_state['tuned_params']}`")
        render_footnote()

# ---------------------------------------------------------------------------
# 6. Pruebas estadísticas
# ---------------------------------------------------------------------------
elif phase.startswith("6"):
    st.header("6. Pruebas estadísticas inferenciales robustas")
    if "cv_results" not in st.session_state:
        st.warning("Ejecute el entrenamiento en la fase 2.")
    else:
        cv_df = st.session_state["cv_results"]
        best = st.session_state.get("best_model", cv_df["model"].unique()[0])
        tests = run_all_inferential_tests(cv_df, best)
        render_table(tests)

        st.markdown("#### Intervalo de confianza bootstrap del MAE (mejor modelo)")
        if best != "Seasonal Naïve (t-12)" and "tuned_model" in st.session_state:
            model = st.session_state["tuned_model"]
            X = modeling[feature_cols]
            y = modeling["demand"].values
            y_pred = model.predict(X)
        elif best != "Seasonal Naïve (t-12)":
            from src.models import get_model_catalog
            spec = next(m for m in get_model_catalog() if m.name == best)
            model = clone(spec.estimator)
            model.fit(modeling[feature_cols], modeling["demand"])
            y = modeling["demand"].values
            y_pred = model.predict(modeling[feature_cols])
        else:
            from src.data_loader import seasonal_naive_predict
            y = modeling["demand"].values
            y_pred = np.array([seasonal_naive_predict(row, raw) for _, row in modeling.iterrows()])

        ci = bootstrap_mae_ci(y, y_pred)
        st.metric("MAE", f"{ci['mae']:.1f}", help=f"IC 95%: [{ci['ci_low']:.1f}, {ci['ci_high']:.1f}]")
        render_footnote()

        st.markdown("#### Diagnóstico de residuos")
        resid = residual_diagnostics(y, y_pred)
        render_table(resid)

        fig = px.histogram(x=y - y_pred, nbins=20, title="Distribución de residuos (y − ŷ)")
        st.plotly_chart(fig, use_container_width=True)
        render_footnote()

# ---------------------------------------------------------------------------
# 7. Reportes
# ---------------------------------------------------------------------------
elif phase.startswith("7"):
    st.header("7. Reportes")
    if "cv_summary" not in st.session_state:
        st.warning("Complete las fases 2–6 antes de generar el reporte.")
    else:
        best = st.session_state.get("best_model", "N/D")
        tuned_params = st.session_state.get("tuned_params")
        importances = pd.DataFrame()

        if best != "Seasonal Naïve (t-12)":
            est = st.session_state.get("tuned_model")
            _, importances = train_final_model(modeling, feature_cols, best, est)

        if len(importances):
            st.markdown("#### Importancia de variables (interpretabilidad)")
            fig_imp = px.bar(importances, x="importance", y="feature", orientation="h",
                             title="Contribución de features al modelo seleccionado")
            st.plotly_chart(fig_imp, use_container_width=True)
            render_footnote()
            render_table(importances.round(4))

        tests = run_all_inferential_tests(st.session_state["cv_results"], best)
        eda_sum = summary_statistics(raw)

        report_md = build_markdown_report(
            meta, eda_sum, st.session_state["cv_summary"], best, tuned_params, tests, importances
        )
        report_pdf = build_pdf_report(
            meta, eda_sum, st.session_state["cv_summary"], best, tuned_params, tests, importances
        )

        col_md, col_pdf = st.columns(2)
        col_md.download_button(
            "Descargar reporte (.md)",
            report_md,
            file_name="reporte_crispdm_trujillo.md",
            mime="text/markdown",
        )
        col_pdf.download_button(
            "Descargar reporte (.pdf)",
            report_pdf,
            file_name="reporte_crispdm_trujillo.pdf",
            mime="application/pdf",
            type="primary",
        )

        if st.button("Guardar reportes en /reports", type="primary"):
            path_md = save_report(report_md)
            path_pdf = save_pdf_report(report_pdf)
            st.success(f"Reportes guardados en `{path_md}` y `{path_pdf}`")

        with st.expander("Vista previa del reporte"):
            st.markdown(report_md)

st.markdown("---")
st.caption(FOOTNOTE)

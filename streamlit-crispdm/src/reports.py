"""Generación de reportes CRISP-DM exportables."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pandas as pd

from .config import FOOTNOTE, REPORTS_DIR


def ensure_reports_dir() -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    return REPORTS_DIR


def build_markdown_report(
    meta: dict,
    eda_summary: pd.DataFrame,
    cv_summary: pd.DataFrame,
    best_model: str,
    best_params: dict | None,
    stats_tests: pd.DataFrame,
    importances: pd.DataFrame | None,
) -> str:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        "# Reporte CRISP-DM — Gemelo Digital Urbano de Salud (Trujillo)",
        f"**Generado:** {ts}",
        f"**Snapshot:** {meta.get('version')} | **Filas modelado:** {meta.get('n_rows_modeling')}",
        "",
        "## 1. Comprensión del negocio y datos",
        "Predicción de demanda SIS distrital para priorización territorial en salud pública.",
        "",
        "### Fuentes públicas",
    ]
    for src in meta.get("sources", []):
        lines.append(f"- {src.get('institution')}: {src.get('name')} ({src.get('period')})")

    lines += [
        "",
        "## 2. EDA — Resumen estadístico",
        eda_summary.head(15).to_markdown(),
        "",
        "## 3. Entrenamiento y selección del mejor modelo",
        cv_summary.to_markdown(index=False),
        "",
        f"**Modelo seleccionado:** {best_model}",
    ]
    if best_params:
        lines.append(f"**Hiperparámetros óptimos:** `{best_params}`")

    lines += [
        "",
        "## 4. Validación cruzada",
        "Validación temporal (TimeSeriesSplit) para respetar orden cronológico del panel SIS.",
        "",
        "## 5. Pruebas estadísticas inferenciales",
        stats_tests.to_markdown(index=False),
        "",
    ]
    if importances is not None and len(importances):
        lines += ["## 6. Interpretabilidad — Importancia de variables", importances.to_markdown(index=False), ""]

    lines += ["---", FOOTNOTE]
    return "\n".join(lines)


def save_report(content: str, prefix: str = "crispdm") -> Path:
    out_dir = ensure_reports_dir()
    path = out_dir / f"{prefix}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    path.write_text(content, encoding="utf-8")
    return path

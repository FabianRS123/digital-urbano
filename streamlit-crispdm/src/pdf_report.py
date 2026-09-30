"""Generación de reporte CRISP-DM en PDF."""

from __future__ import annotations

import io
import os
from datetime import datetime
from pathlib import Path

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .config import FOOTNOTE, REPORTS_DIR


def _register_fonts() -> str:
    """Registra fuente Unicode (Arial en Windows, Helvetica en otros)."""
    candidates = [
        Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts" / "arial.ttf",
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
    ]
    for path in candidates:
        if path.exists():
            pdfmetrics.registerFont(TTFont("ReportFont", str(path)))
            return "ReportFont"
    return "Helvetica"


def _df_table(df: pd.DataFrame, font: str, max_rows: int = 20) -> Table:
    subset = df.head(max_rows).copy()
    for col in subset.columns:
        if subset[col].dtype in ("float64", "float32"):
            subset[col] = subset[col].round(4)
    headers = [str(c) for c in subset.columns]
    rows = [[str(v) for v in row] for row in subset.values.tolist()]
    data = [headers] + rows
    table = Table(data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, -1), font),
                ("FONTSIZE", (0, 0), (-1, 0), 8),
                ("FONTSIZE", (0, 1), (-1, -1), 7),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def build_pdf_report(
    meta: dict,
    eda_summary: pd.DataFrame,
    cv_summary: pd.DataFrame,
    best_model: str,
    best_params: dict | None,
    stats_tests: pd.DataFrame,
    importances: pd.DataFrame | None,
) -> bytes:
    font = _register_fonts()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=2 * cm,
        title="Reporte CRISP-DM GDUS Trujillo",
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleGDUS",
        parent=styles["Heading1"],
        fontName=font,
        fontSize=16,
        spaceAfter=12,
        alignment=TA_CENTER,
    )
    h2 = ParagraphStyle("H2GDUS", parent=styles["Heading2"], fontName=font, fontSize=12, spaceBefore=14, spaceAfter=8)
    body = ParagraphStyle("BodyGDUS", parent=styles["Normal"], fontName=font, fontSize=9, leading=12, alignment=TA_JUSTIFY)
    foot = ParagraphStyle("FootGDUS", parent=styles["Normal"], fontName=font, fontSize=7, leading=9, textColor=colors.grey)

    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    story: list = []

    story.append(Paragraph("Reporte CRISP-DM", title_style))
    story.append(Paragraph("Gemelo Digital Urbano de Salud — Trujillo", body))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(f"<b>Generado:</b> {ts}", body))
    story.append(Paragraph(f"<b>Snapshot:</b> {meta.get('version')} | <b>Filas modelado:</b> {meta.get('n_rows_modeling')}", body))
    story.append(Spacer(1, 0.5 * cm))

    story.append(Paragraph("1. Comprensión del negocio y datos", h2))
    story.append(
        Paragraph(
            "Predicción de demanda SIS distrital para priorización territorial en salud pública.",
            body,
        )
    )
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph("<b>Fuentes públicas</b>", body))
    for src in meta.get("sources", []):
        story.append(
            Paragraph(
                f"• {src.get('institution')}: {src.get('name')} ({src.get('period')})",
                body,
            )
        )

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("2. EDA — Resumen estadístico", h2))
    story.append(_df_table(eda_summary.reset_index().rename(columns={"index": "variable"}), font, 15))
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("3. Entrenamiento y selección del mejor modelo", h2))
    story.append(_df_table(cv_summary, font))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(f"<b>Modelo seleccionado:</b> {best_model}", body))
    if best_params:
        story.append(Paragraph(f"<b>Hiperparámetros óptimos:</b> {best_params}", body))

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("4. Validación cruzada", h2))
    story.append(
        Paragraph(
            "Validación temporal (TimeSeriesSplit) para respetar el orden cronológico del panel SIS (2024–2025).",
            body,
        )
    )

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("5. Pruebas estadísticas inferenciales", h2))
    story.append(_df_table(stats_tests, font))

    if importances is not None and len(importances):
        story.append(Spacer(1, 0.4 * cm))
        story.append(Paragraph("6. Interpretabilidad — Importancia de variables", h2))
        story.append(_df_table(importances, font))

    story.append(Spacer(1, 0.6 * cm))
    footnote_clean = FOOTNOTE.replace("**", "")
    story.append(Paragraph(f"<i>{footnote_clean}</i>", foot))

    doc.build(story)
    return buffer.getvalue()


def save_pdf_report(pdf_bytes: bytes, prefix: str = "crispdm") -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    path = REPORTS_DIR / f"{prefix}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    path.write_bytes(pdf_bytes)
    return path

"""Componentes visuales de la interfaz: estilo, encabezado, indicadores y tablas que se pueden copiar y exportar."""

from __future__ import annotations

import html

import pandas as pd
import streamlit as st

from figuras import exportar

CSS = """
<style>
:root { --azul:#2a78d6; --marino:#0f2747; --borde:#e3e8f0; --suave:#5b6b83; --fondo-suave:#eef4fd; }
.block-container { padding-top: 1.4rem; padding-bottom: 3rem; max-width: 1240px; }
footer, #MainMenu { visibility: hidden; }
h1, h2, h3 { color: var(--marino); letter-spacing: -0.01em; }
h1 { font-weight: 750; font-size: 1.85rem; margin-bottom: .2rem; }

/* encabezado */
.hero { background: linear-gradient(115deg, #0f2747 0%, #17406f 55%, #2a78d6 100%); color: #fff; border-radius: 18px;
        padding: 26px 32px 22px; margin-bottom: 22px; box-shadow: 0 10px 28px rgba(15,39,71,.20); }
.hero .sobre { text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: #a9c6ee; font-weight: 600; }
.hero h1 { color: #fff; margin: 4px 0 6px; font-size: 1.95rem; }
.hero p { color: #dbe7f7; margin: 0; max-width: 780px; line-height: 1.5; font-size: .98rem; }
.hero .chips span { display: inline-block; background: rgba(255,255,255,.13); border: 1px solid rgba(255,255,255,.26);
        color: #fff; border-radius: 999px; padding: 3px 13px; font-size: .78rem; margin: 14px 8px 0 0; }

/* cabecera de cada figura o tabla */
.etiqueta { text-transform: uppercase; letter-spacing: .1em; font-size: .72rem; font-weight: 700; color: var(--azul); }
.pill { display: inline-block; border-radius: 999px; padding: 3px 12px; font-size: .76rem; font-weight: 650; margin-left: 8px; vertical-align: middle; }
.pill.ok { background: #e7f6ec; color: #166534; border: 1px solid #bfe5cb; }
.pill.filtro { background: #fff4e5; color: #9a5b00; border: 1px solid #f6d9a8; }
.pill.neutro { background: #eef2f8; color: #3b4a63; border: 1px solid #dbe3ef; }
.callout { border-left: 4px solid var(--azul); background: var(--fondo-suave); border-radius: 10px; padding: 12px 18px;
           color: #17233a; margin: 10px 0 16px; line-height: 1.5; }
.callout b { color: var(--marino); }
.pie { color: var(--suave); font-size: .86rem; line-height: 1.5; margin-top: 8px; }
.pie b { color: #17233a; }

/* indicadores */
.kpi { background: #fff; border: 1px solid var(--borde); border-radius: 14px; padding: 16px 20px; height: 100%; }
.kpi .v { font-size: 1.95rem; font-weight: 750; color: var(--marino); line-height: 1.1; }
.kpi .l { color: var(--suave); font-size: .84rem; margin-top: 4px; }
.kpi.ok .v { color: #166534; }

/* tarjetas y contenedores */
div[data-testid="stVerticalBlockBorderWrapper"] { background: #fff; border-radius: 14px; border-color: var(--borde);
        box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.tarjeta-titulo { font-weight: 700; color: var(--marino); font-size: 1.02rem; margin: 6px 0 2px; min-height: 2.9rem; }
.tarjeta-texto { color: #3b4a63; font-size: .88rem; line-height: 1.45; min-height: 7.6rem; }
.miniatura { height: 168px; display: flex; align-items: center; justify-content: center; background: #fff; border: 1px solid #eef1f6;
             border-radius: 10px; overflow: hidden; padding: 6px; }
.miniatura img { max-width: 100%; max-height: 100%; object-fit: contain; }
.paso { background: #fff; border: 1px solid var(--borde); border-radius: 14px; padding: 16px 18px; min-height: 168px; }
.paso .n { display: inline-flex; width: 26px; height: 26px; border-radius: 50%; background: var(--azul); color: #fff;
           align-items: center; justify-content: center; font-weight: 700; font-size: .82rem; margin-bottom: 8px; }
.paso b { color: var(--marino); }
.paso p { color: #3b4a63; font-size: .88rem; margin: 4px 0 0; line-height: 1.45; }

/* pestañas, botones y barra lateral */
.stTabs [data-baseweb="tab-list"] { gap: 4px; border-bottom: 1px solid var(--borde); }
.stTabs [data-baseweb="tab"] { padding: 9px 16px; font-weight: 600; border-radius: 10px 10px 0 0; }
.stDownloadButton button, .stButton button, div[data-testid="stPopover"] button { border-radius: 10px; font-weight: 600; }
section[data-testid="stSidebar"] { border-right: 1px solid var(--borde); }
.marca { display: flex; align-items: center; gap: 11px; margin: 4px 0 14px; }
.marca .logo { width: 38px; height: 38px; border-radius: 11px; background: linear-gradient(135deg, #2a78d6, #0f2747);
               display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 1.05rem; }
.marca .t { font-weight: 750; color: var(--marino); line-height: 1.15; }
.marca .s { color: var(--suave); font-size: .76rem; }
.filtro-titulo { text-transform: uppercase; letter-spacing: .1em; font-size: .72rem; font-weight: 700; color: var(--suave); margin: 6px 0 -4px; }
.nota-tabla { color: var(--suave); font-size: .83rem; line-height: 1.5; margin-top: 6px; }
</style>
"""


def aplicar_tema() -> None:
    st.markdown(CSS, unsafe_allow_html=True)


def hero(sobre: str, titulo: str, texto: str, chips: list[str]) -> None:
    fichas = "".join(f"<span>{html.escape(c)}</span>" for c in chips)
    st.markdown(
        f'<div class="hero"><div class="sobre">{html.escape(sobre)}</div><h1>{html.escape(titulo)}</h1>'
        f'<p>{html.escape(texto)}</p><div class="chips">{fichas}</div></div>',
        unsafe_allow_html=True,
    )


def cabecera(etiqueta: str, titulo: str, estado: tuple[str, str] | None = None, nivel: int = 1) -> None:
    pill = f'<span class="pill {estado[1]}">{html.escape(estado[0])}</span>' if estado else ""
    st.markdown(f'<div class="etiqueta">{html.escape(etiqueta)}{pill}</div>', unsafe_allow_html=True)
    st.title(titulo) if nivel == 1 else st.subheader(titulo)


def miniatura(uri_datos: str) -> None:
    st.markdown(f'<div class="miniatura"><img src="{uri_datos}" alt=""></div>', unsafe_allow_html=True)


def callout(titulo: str, texto: str) -> None:
    st.markdown(f'<div class="callout"><b>{html.escape(titulo)}</b> {html.escape(texto)}</div>', unsafe_allow_html=True)


def kpi(valor: str, etiqueta: str, clase: str = "") -> None:
    st.markdown(f'<div class="kpi {clase}"><div class="v">{html.escape(valor)}</div><div class="l">{html.escape(etiqueta)}</div></div>',
                unsafe_allow_html=True)


def pie(etiqueta: str, texto: str, fuente: str) -> None:
    st.markdown(f'<div class="pie"><b>{html.escape(etiqueta)}.</b> {html.escape(texto)}<br>Fuente: {html.escape(fuente)}</div>',
                unsafe_allow_html=True)


def tabla_exportable(mostrar: pd.DataFrame, exportar_df: pd.DataFrame | None, clave: str, nombre_archivo: str,
                     nota: str = "", altura: int | None = None) -> None:
    """Tabla con selección y copia nativas (Ctrl+C) y botones para copiar, descargar CSV y descargar Excel."""
    exportar_df = mostrar if exportar_df is None else exportar_df
    filas = len(mostrar)
    st.dataframe(mostrar, hide_index=True, width="stretch", height=altura or min(35 * (filas + 1) + 3, 460))
    c1, c2, c3, _ = st.columns([1.1, 1, 1, 3])
    with c1.popover("Copiar tabla", icon=":material/content_copy:", width="stretch"):
        LIMITE = 600
        st.caption("Pulse el ícono de copiar en la esquina del recuadro y pegue en Excel, Word o Google Sheets."
                   + (f" Se copian las primeras {LIMITE} filas; para todas use CSV o Excel." if filas > LIMITE else ""))
        st.code(exportar.texto_para_copiar(mostrar.head(LIMITE)), language=None)
    c2.download_button("CSV", exportar.csv_bytes(exportar_df), file_name=f"{nombre_archivo}.csv", mime="text/csv",
                       icon=":material/description:", width="stretch", key=f"csv_{clave}")
    c3.download_button("Excel", exportar.excel_bytes({"Tabla": exportar_df}), file_name=f"{nombre_archivo}.xlsx",
                       mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                       icon=":material/table_view:", width="stretch", key=f"xlsx_{clave}")
    if nota:
        st.markdown(f'<div class="nota-tabla">{html.escape(nota)}</div>', unsafe_allow_html=True)

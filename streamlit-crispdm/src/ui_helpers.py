"""Componentes de UI reutilizables con pie interpretativo."""

import streamlit as st

from .config import FOOTNOTE, DATASET_SOURCES


def render_footnote():
    st.caption(FOOTNOTE)


def render_table(df, **kwargs):
    st.dataframe(df, use_container_width=True, **kwargs)
    render_footnote()


def render_metric_row(items: list[tuple[str, str, str | None]]):
    cols = st.columns(len(items))
    for col, (label, value, help_text) in zip(cols, items):
        col.metric(label, value, help=help_text)
    render_footnote()


def render_sources():
    st.markdown("#### Fuentes públicas del dataset")
    for key, desc in DATASET_SOURCES.items():
        st.markdown(f"- **{key.upper()}:** {desc}")
    render_footnote()

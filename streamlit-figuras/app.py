"""Figuras y tablas del artículo GDUS Trujillo, regeneradas desde los datos y filtrables por distrito.

Ejecutar desde esta carpeta:  streamlit run app.py
"""

from __future__ import annotations

import streamlit as st

import interfaz
import paginas
from figuras import datos
from figuras.catalogo import FIGURAS

st.set_page_config(page_title="Figuras del artículo · GDUS Trujillo", page_icon=":material/analytics:", layout="wide")
interfaz.aplicar_tema()

NOMBRES = datos.nombres_distritos()
if "distritos" not in st.session_state:
    st.session_state["distritos"] = []  # vacío equivale a los diez distritos, la vista del Word


def _pagina(funcion, titulo: str, icono: str, url: str, **kw) -> st.Page:
    return st.Page(funcion, title=titulo, icon=icono, url_path=url, **kw)


def _figura(clave: str):
    def vista():
        paginas.pagina_figura(clave)
    vista.__name__ = f"figura_{clave}"
    return vista


paginas.PAGINAS["resumen"] = _pagina(paginas.resumen, "Resumen", ":material/dashboard:", "resumen", default=True)
for f in FIGURAS:
    paginas.PAGINAS[f.clave] = _pagina(_figura(f.clave), f"{f.etiqueta} · {f.titulo}", f.icono, f.nombre_archivo.lower())
paginas.PAGINAS["tablas"] = _pagina(paginas.pagina_tablas, "Tablas del artículo", ":material/table_chart:", "tablas")

navegacion = st.navigation({
    "Panorama": [paginas.PAGINAS["resumen"]],
    "Figuras": [paginas.PAGINAS[f.clave] for f in FIGURAS],
    "Tablas": [paginas.PAGINAS["tablas"]],
})

with st.sidebar:
    st.markdown('<div class="filtro-titulo">Ubicación</div>', unsafe_allow_html=True)
    st.multiselect(
        "Distritos", NOMBRES, key="distritos", placeholder="Todos los distritos (como en el Word)",
        help="Provincia de Trujillo, La Libertad. Sin elegir nada se muestran los diez distritos y las figuras son las del Word. "
             "Si elige uno o varios, cada figura y tabla se recalcula solo con ellos.",
    )
    sel = datos.normalizar(st.session_state.get("distritos"))
    if sel is None:
        st.caption("Vista del Word: los diez distritos.")
    else:
        st.caption(f"Filtro activo: {len(sel)} de {len(NOMBRES)} distritos.")
    st.button("Quitar filtro", on_click=lambda: st.session_state.update(distritos=[]),
              icon=":material/filter_alt_off:", width="stretch", disabled=sel is None)

navegacion.run()

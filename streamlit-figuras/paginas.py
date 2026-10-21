"""Páginas de la aplicación: resumen, una vista por figura y tablas del artículo."""

from __future__ import annotations

import base64
import io
import threading

import numpy as np
import pandas as pd
import streamlit as st
from PIL import Image

import interfaz
from figuras import datos, exportar, tablas, verificacion
from figuras.catalogo import FIGURAS, POR_CLAVE

PAGINAS: dict[str, st.Page] = {}  # lo completa app.py para poder enlazar entre páginas
_CERROJO = threading.Lock()  # matplotlib no es seguro entre hilos


# ------------------------------------------------------------------ selección y caché

def seleccion() -> tuple[str, ...] | None:
    """Distritos elegidos en la barra lateral; None equivale a los diez (la vista del Word)."""
    return datos.normalizar(st.session_state.get("distritos"))


def _sufijo(sel) -> str:
    return "" if sel is None else "_filtrada"


def _estado(sel) -> tuple[str, str]:
    return ("Vista del Word", "ok") if sel is None else (f"Filtrada · {len(sel)} de 10 distritos", "filtro")


@st.cache_resource(show_spinner="Calculando la figura desde los datos...", max_entries=24)
def construir(clave: str, sel):
    with _CERROJO:
        return POR_CLAVE[clave].constructor(sel)


@st.cache_data(show_spinner=False, max_entries=60)
def archivo(clave: str, sel, formato: str) -> bytes:
    figura = POR_CLAVE[clave]
    fig, _ = construir(clave, sel)
    with _CERROJO:
        return {"png": lambda: exportar.png(figura, fig), "svg": lambda: exportar.svg(fig), "pdf": lambda: exportar.pdf(fig)}[formato]()


@st.cache_data(show_spinner=False, max_entries=30)
def excel_figura(clave: str, sel) -> bytes:
    return exportar.excel_bytes({_titulo_tabla(k)[:31]: _bonita(v) for k, v in exportar.tablas_de(construir(clave, sel)[1]).items()})


@st.cache_data(show_spinner=False)
def miniatura_uri(clave: str) -> str:
    """Miniatura de la imagen original del Word como URI de datos (para las tarjetas del resumen)."""
    im = Image.open(POR_CLAVE[clave].imagen_word).convert("RGB")
    im.thumbnail((640, 640))
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=88)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


@st.cache_data(show_spinner=False)
def superposicion(clave: str) -> bytes:
    """Original en el canal rojo y regenerada en verde y azul: gris donde coinciden."""
    original = Image.open(POR_CLAVE[clave].imagen_word).convert("L")
    nueva = Image.open(io.BytesIO(archivo(clave, None, "png"))).convert("L").resize(original.size)
    buf = io.BytesIO()
    Image.fromarray(np.stack([np.array(original), np.array(nueva), np.array(nueva)], axis=2)).save(buf, format="PNG")
    return buf.getvalue()


@st.cache_data(show_spinner="Recalculando las cifras del Word...")
def comprobaciones() -> pd.DataFrame:
    return verificacion.comprobaciones()


@st.cache_data(show_spinner=False, max_entries=40)
def tabla(clave: str, sel):
    return {"t2": tablas.tabla_2, "t3": tablas.tabla_3, "ts2": tablas.tabla_s2}[clave](sel)


@st.cache_data(show_spinner=False)
def tabla_fija(clave: str):
    return {"ts3": tablas.tabla_s3, "ts4": tablas.tabla_s4}[clave]()


def _todas_las_tablas(sel):
    return [tabla("t2", sel), tabla("t3", sel), tabla("ts2", sel), tabla_fija("ts3"), tabla_fija("ts4")]


_COLUMNAS = {
    "mae": "MAE", "modelo": "Modelo", "pliegue": "Pliegue", "variable": "Variable", "importancia": "Importancia relativa",
    "distrito": "Distrito", "mes": "Mes", "tipo": "Serie", "consultas": "Consultas", "inferior90": "Límite inferior 90 %",
    "superior90": "Límite superior 90 %", "indice_prioridad": "Índice de prioridad", "tiempo_viaje_min": "Tiempo de viaje (min)",
    "latitud": "Latitud", "longitud": "Longitud", "codigo": "Código", "nombre": "Nombre", "categoria": "Categoría",
    "institucion": "Institución", "prioridad_basal": "Prioridad basal", "new_facility": "Nueva IPRESS",
    "expand_capacity": "Ampliación", "improve_access": "Mejora de acceso", "temporary_closure": "Cierre temporal",
    "quintil": "Quintil", "poblacion": "Población", "ipress_por_100k": "IPRESS por 100.000 hab.",
    "concentration": "Índice de concentración", "ciLow": "IC 95 % inferior", "ciHigh": "IC 95 % superior",
    "q1": "Quintil 1", "q5": "Quintil 5", "q5OverQ1": "Razón Q5/Q1", "indicador": "Indicador", "alfa": "α",
    "proporcion": "Proporción", "mensaje": "Aviso",
}


def _bonita(tabla_df: pd.DataFrame) -> pd.DataFrame:
    def nombre(c: str) -> str:
        if c in _COLUMNAS:
            return _COLUMNAS[c]
        if c.startswith("tau_alfa_"):
            return f"Tau de Kendall (α = {c.rsplit('_', 1)[1]})"
        return c.replace("_", " ").capitalize()
    return tabla_df.rename(columns=nombre)


def _titulo_tabla(clave_tabla: str) -> str:
    if clave_tabla.startswith("panel_"):
        _, letra, resto = clave_tabla.split("_", 2)
        return f"Panel {letra.upper()}: {resto.replace('_', ' ')}"
    return clave_tabla.replace("_", " ").capitalize()


def _estado_cifras(df: pd.DataFrame) -> str:
    return df["Estado"].map({"Coincide": "✓ Coincide", "Redondeo": "≈ Redondeo", "Difiere": "✗ Difiere"})


def _tabla_comprobaciones(df: pd.DataFrame, clave: str, nombre: str) -> None:
    vista = df.drop(columns=[c for c in ("Figura", "Coincide") if c in df.columns]).assign(Estado=_estado_cifras(df))
    interfaz.tabla_exportable(vista, None, clave=clave, nombre_archivo=nombre, altura=380)


# ------------------------------------------------------------------ resumen

def resumen() -> None:
    snap = datos.snapshot()
    interfaz.hero(
        "Gemelos digitales de salud urbana · Trujillo, Perú", "Figuras y tablas del artículo",
        "Las figuras del manuscrito se regeneran desde los datos oficiales del repositorio, se comparan con las imágenes "
        "del Word y se pueden filtrar por distrito, descargar y copiar.",
        [f"Datos versión {snap['version'][:8]}", "SIS enero 2024 a diciembre 2025", "Mes de referencia: diciembre 2025", "10 distritos"],
    )
    df = comprobaciones()
    exactas = int((df["Estado"] == "Coincide").sum())
    redondeo = int((df["Estado"] == "Redondeo").sum())
    difieren = int((df["Estado"] == "Difiere").sum())

    k = st.columns(4)
    with k[0]:
        interfaz.kpi(str(len(FIGURAS)), "figuras regeneradas")
    with k[1]:
        interfaz.kpi("5", "tablas del artículo")
    with k[2]:
        interfaz.kpi(f"{exactas} de {len(df)}", "cifras del Word recalculadas igual", "ok")
    with k[3]:
        interfaz.kpi(f"{redondeo + difieren}", "diferencias para revisar en el Word")

    st.markdown("### Cómo usarla")
    p = st.columns(3)
    pasos = [
        ("1", "Elija la ubicación", "En la barra lateral aparecen los diez distritos. Por defecto están todos y cada figura es la del Word; "
                                    "si elige uno o varios, la figura se regenera solo con ellos."),
        ("2", "Descargue", "Cada figura se baja en PNG (300 dpi), SVG o PDF, y sus datos en Excel."),
        ("3", "Copie las tablas", "Las tablas se pueden seleccionar y copiar con Ctrl+C, copiar con un botón o exportar a CSV y Excel."),
    ]
    for col, (n, titulo, texto) in zip(p, pasos):
        col.markdown(f'<div class="paso"><span class="n">{n}</span><br><b>{titulo}</b><p>{texto}</p></div>', unsafe_allow_html=True)

    st.markdown("### Figuras")
    columnas: list = []
    for i, f in enumerate(FIGURAS):
        if i % 3 == 0:
            columnas = st.columns(3)
        with columnas[i % 3]:
            with st.container(border=True):
                interfaz.miniatura(miniatura_uri(f.clave))
                st.markdown(f'<div class="etiqueta">{f.etiqueta}</div><div class="tarjeta-titulo">{f.titulo}</div>'
                            f'<div class="tarjeta-texto">{f.que_demuestra}</div>', unsafe_allow_html=True)
                st.page_link(PAGINAS[f.clave], label="Abrir figura", icon=":material/arrow_forward:")

    st.markdown("### Descargar todo")
    sel = seleccion()
    st.caption("Incluye las seis figuras en PNG, SVG y PDF, sus datos en Excel y la tabla de comprobaciones. "
               + ("Usa el filtro de ubicación actual." if sel else "Usa la vista del Word (los diez distritos)."))
    if st.button("Preparar archivo ZIP", icon=":material/folder_zip:"):
        with st.spinner("Generando archivos..."):
            construidas = {f.clave: construir(f.clave, sel) for f in FIGURAS}
            with _CERROJO:
                st.session_state["zip_total"] = exportar.todo(construidas, comprobaciones(), _sufijo(sel))
    if "zip_total" in st.session_state:
        st.download_button("Descargar figuras_articulo.zip", st.session_state["zip_total"], file_name="figuras_articulo.zip",
                           mime="application/zip", icon=":material/download:", type="primary")

    with st.expander(f"Detalle de las {len(df)} cifras verificadas contra el Word"):
        st.caption("✓ coincide al redondear · ≈ coincide solo si se redondea dos veces (el Word redondeó dos veces) · ✗ difiere.")
        eleccion = st.multiselect("Filtrar por figura o tabla", list(dict.fromkeys(df["Figura"])), key="filtro_comprobaciones")
        sub = df if not eleccion else df[df["Figura"].isin(eleccion)]
        vista = sub.drop(columns="Coincide").assign(Estado=_estado_cifras(sub))
        interfaz.tabla_exportable(vista, None, clave="comprobaciones", nombre_archivo="comprobaciones_word", altura=420)


# ------------------------------------------------------------------ figuras

def pagina_figura(clave: str) -> None:
    f = POR_CLAVE[clave]
    sel = seleccion()
    interfaz.cabecera(f.etiqueta, f.titulo, _estado(sel))
    interfaz.callout("Qué demuestra.", f.que_demuestra)
    if sel is not None:
        st.caption(f"Filtro de ubicación activo: {', '.join(sel)}. {f.filtra}")

    fig, datos_fig = construir(clave, sel)
    png = archivo(clave, sel, "png")
    suf = _sufijo(sel)
    barra = st.columns([1, 1, 1, 1.3, 2.4])
    barra[0].download_button("PNG", png, file_name=f"{f.nombre_archivo}{suf}.png", mime="image/png",
                             icon=":material/image:", width="stretch")
    barra[1].download_button("SVG", archivo(clave, sel, "svg"), file_name=f"{f.nombre_archivo}{suf}.svg",
                             mime="image/svg+xml", icon=":material/polyline:", width="stretch")
    barra[2].download_button("PDF", archivo(clave, sel, "pdf"), file_name=f"{f.nombre_archivo}{suf}.pdf",
                             mime="application/pdf", icon=":material/picture_as_pdf:", width="stretch")
    barra[3].download_button("Datos (Excel)", excel_figura(clave, sel), file_name=f"{f.nombre_archivo}{suf}_datos.xlsx",
                             mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             icon=":material/table_view:", width="stretch")

    t_fig, t_cmp, t_dat, t_ver = st.tabs(["Figura", "Comparar con el Word", "Datos", "Cifras verificadas"])

    with t_fig:
        with st.container(border=True):
            st.image(png, width="stretch")
        interfaz.pie(f.etiqueta, f.pie, f.fuente)

    with t_cmp:
        izq, der = st.columns(2)
        izq.markdown("**Original del Word**")
        izq.image(str(f.imagen_word), width="stretch")
        der.markdown("**Regenerada desde los datos**" if sel is None else "**Vista filtrada actual**")
        der.image(png, width="stretch")
        if sel is None:
            if st.toggle("Superponer las dos imágenes", key=f"sup_{clave}"):
                st.image(superposicion(clave), width="stretch")
                st.caption("Gris: las dos imágenes coinciden. Rojo o cian: diferencias de un par de píxeles, normalmente en el borde de los textos.")
        else:
            st.caption("Con un filtro activo la figura ya no es la del Word. Vuelva a elegir los diez distritos para compararlas píxel a píxel.")

    with t_dat:
        tablas_fig = exportar.tablas_de(datos_fig)
        for i, (nombre, t) in enumerate(tablas_fig.items()):
            if len(tablas_fig) > 1:
                st.markdown(f"**{_titulo_tabla(nombre)}**")
            interfaz.tabla_exportable(_bonita(t), None, clave=f"{clave}_{i}", nombre_archivo=f"{f.nombre_archivo}_{nombre}{suf}".lower())

    with t_ver:
        df = comprobaciones()
        sub = df[df["Figura"] == f.etiqueta]
        exactas = int((sub["Estado"] == "Coincide").sum())
        st.write(f"**{exactas} de {len(sub)}** cifras del artículo asociadas a esta figura se recalculan igual desde los datos.")
        if sel is not None:
            st.caption("Esta comprobación usa siempre los diez distritos, que es el caso que describe el Word.")
        _tabla_comprobaciones(sub, f"ver_{clave}", f"comprobaciones_{f.nombre_archivo}")

    if clave == "s1":
        with st.expander("Nota para los autores sobre la persistencia estacional"):
            st.write(
                "En la validación cruzada la tabla de modelado solo contiene 2025 (los rezagos de 12 meses eliminan 2024). "
                "La función run_baseline busca el mismo mes del año anterior en esos datos de entrenamiento, no lo encuentra "
                "y recurre al último mes de entrenamiento de cada distrito. Por eso el MAE de 657,5 corresponde a ese respaldo "
                "y no a una persistencia t−12 real, que daría un MAE de 640,0 y una prueba de Wilcoxon con W = 2 y p = 0,19 "
                "frente a la potenciación de gradiente."
            )


# ------------------------------------------------------------------ tablas

def pagina_tablas() -> None:
    sel = seleccion()
    interfaz.hero(
        "Datos del artículo", "Tablas del artículo",
        "Las tablas que se calculan a partir de los datos, con el mismo formato del manuscrito. "
        "Se pueden seleccionar y copiar, copiar con un botón o exportar a CSV y Excel.",
        ["Tablas 2, 3, S2, S3 y S4", "Coma decimal", "Filtrables por distrito: 2, 3 y S2"],
    )
    todas = _todas_las_tablas(sel)
    opciones = [t.etiqueta for t in todas]
    elegida = st.segmented_control("Tabla", opciones, default=opciones[0], key="tabla_elegida", label_visibility="collapsed")
    t = todas[opciones.index(elegida or opciones[0])]

    estado = ("Vista del Word", "ok") if (sel is None or not t.filtrable) else (f"Filtrada · {len(sel)} de 10 distritos", "filtro")
    if not t.filtrable:
        estado = ("No depende del filtro", "neutro")
    interfaz.cabecera(t.etiqueta, t.titulo.split(",")[0], estado, nivel=3)
    st.markdown(f'<div class="pie"><b>{t.etiqueta}.</b> {t.titulo}</div>', unsafe_allow_html=True)
    for aviso in t.avisos:
        st.info(aviso)
    interfaz.tabla_exportable(t.mostrar, t.exportar, clave=f"tabla_{t.clave}", nombre_archivo=f"{t.etiqueta.replace(' ', '_').lower()}{_sufijo(sel) if t.filtrable else ''}", nota=t.nota)
    st.caption(f"Fuente: {t.fuente}")

    df = comprobaciones()
    sub = df[df["Figura"] == t.etiqueta]
    if len(sub):
        with st.expander(f"Cifras de esta tabla verificadas contra el Word ({int((sub['Estado'] == 'Coincide').sum())} de {len(sub)} coinciden)"):
            _tabla_comprobaciones(sub, f"vertab_{t.clave}", f"comprobaciones_{t.etiqueta.replace(' ', '_').lower()}")

    st.divider()
    st.download_button(
        "Descargar todas las tablas en un libro de Excel",
        exportar.excel_bytes({x.etiqueta: x.exportar for x in todas}), file_name=f"tablas_articulo{_sufijo(sel)}.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", icon=":material/table_view:",
    )

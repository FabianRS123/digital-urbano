"""Constructores de las figuras del artículo. Cada función devuelve (figura, tablas de datos).

Todas aceptan `distritos`: None (o los diez distritos) reproduce la figura del Word; una selección menor
regenera la figura solo con esos distritos.
"""

from __future__ import annotations

import datetime as dt
import math
import textwrap
from pathlib import Path

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.cm import ScalarMappable
from matplotlib.colors import Normalize
from matplotlib.lines import Line2D
from matplotlib.patches import Patch, Polygon
from matplotlib.ticker import FixedLocator, FuncFormatter, MaxNLocator

from . import datos, modelo
from .estilo import (
    AZUL, AZUL_CLARO, AZUL_MEDIO, CMAP_CAMBIO, CMAP_PRIORIDAD, CMAP_TIEMPO, MARINO, MESES_ES, NARANJA, NEGRO,
    TEXTO, ejes_px, formateador, lienzo, limpiar_ejes, num,
)

ABREVIATURAS = {"Víctor Larco Herrera": "V. Larco Herrera"}
ASSETS_WORD = Path(__file__).resolve().parents[1] / "assets" / "word"
GRIS_CONTEXTO = "#e6e9ef"
GRIS_NOTA = "#6b7280"


EXTRA_NOTA = 64  # píxeles que se agregan abajo cuando la figura lleva nota de filtro


def _nota(fig, texto: str, y_px: float, ancho_fig_px: float, alto_fig_px: float, ancho_texto: int | None = None) -> None:
    ancho = int(ancho_fig_px / 17)
    fig.text(0.5, 1 - y_px / alto_fig_px, textwrap.fill(texto, ancho), ha="center", va="center",
             fontsize=6.3, color=GRIS_NOTA, linespacing=1.3)


def _mensaje(ax, texto: str) -> None:
    ax.axis("off")
    ax.text(0.5, 0.5, textwrap.fill(texto, 38), ha="center", va="center", fontsize=8, color=GRIS_NOTA, transform=ax.transAxes)


def _texto_seleccion(sel: tuple[str, ...] | None) -> str:
    return "Vista del artículo: los diez distritos" if sel is None else "Distritos mostrados: " + ", ".join(sel)


# ----------------------------------------------------------------------------- Figura 2

# Transformación píxel <-> coordenadas calibrada con los puntos distritales de la figura original (2094 x 825 px).
_PX_LNG, _PX_LNG0 = 1056.46, 83984.3
_PX_LAT, _PX_LAT0 = -1071.01, -8323.6
_DESPLAZ_B = 963.5
_IZQUIERDOS = ("Huanchaco", "El Porvenir", "La Esperanza", "Florencia de Mora", "Trujillo", "Víctor Larco Herrera", "Moche")
_Y_ETIQUETAS = (189.5, 242.5, 298.0, 349.5, 404.5, 456.0, 509.5)
_GRANDES = ("Poroto", "Laredo", "Salaverry")


def _lng(x: float, desplaz: float = 0.0) -> float:
    return (x - desplaz - _PX_LNG0) / _PX_LNG


def _lat(y: float) -> float:
    return (y - _PX_LAT0) / _PX_LAT


def _anillos(t):
    g = t.geometry
    poligonos = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    return [np.asarray(anillo) for poligono in poligonos for anillo in poligono]


def _zoom(elegidos):
    """Transformación que encaja los distritos elegidos en la zona derecha del mapa, con la proporción original."""
    puntos = np.vstack([a for t in elegidos for a in _anillos(t)])
    lng0, lng1 = puntos[:, 0].min(), puntos[:, 0].max()
    lat0, lat1 = puntos[:, 1].min(), puntos[:, 1].max()
    ancho_px, alto_px = (lng1 - lng0) * _PX_LNG, (lat1 - lat0) * abs(_PX_LAT)
    f = min(500 / ancho_px, 470 / alto_px, 7.0)
    cx, cy = 622.0, 372.0
    lng_c, lat_c = (lng0 + lng1) / 2, (lat0 + lat1) / 2
    return (lambda x, d=0.0: lng_c + (x - d - cx) / (_PX_LNG * f)), (lambda y: lat_c + (y - cy) / (_PX_LAT * f))


def _panel_mapa(fig, desplaz, valores, cmap, norm, formato, ipress=None, sel=None):
    izq, arriba, der, abajo = 28 + desplaz, 100, 882 + desplaz, 628
    ax = ejes_px(fig, izq, arriba, der, abajo)
    v = datos.vista()
    elegidos = modelo.seleccionar(v, sel)
    lng_f, lat_f = (_lng, _lat) if sel is None else _zoom(elegidos)
    ax.set_xlim(lng_f(izq, desplaz), lng_f(der, desplaz))
    ax.set_ylim(lat_f(abajo), lat_f(arriba))
    ax.axis("off")
    nombres_sel = {t.name for t in elegidos}
    for t in v.territorios:
        color = cmap(norm(valores[t.name])) if t.name in nombres_sel else GRIS_CONTEXTO
        for anillo in _anillos(t):
            ax.add_patch(Polygon(anillo, closed=True, facecolor=color, edgecolor="white", linewidth=1.0, joinstyle="round"))
    if ipress:
        ax.scatter([f["longitude"] for f in ipress], [f["latitude"] for f in ipress], marker="^", s=8,
                   facecolor="white", edgecolor="black", linewidth=0.5, zorder=5)
    x_der = 351 + desplaz
    izquierdos = [n for n in _IZQUIERDOS if n in nombres_sel]
    if sel is None:
        ys = _Y_ETIQUETAS
    else:  # bloque de etiquetas centrado verticalmente, con el mismo paso que el original
        ys = [349.5 + (k - (len(izquierdos) - 1) / 2) * 53.5 for k in range(len(izquierdos))]
    for nombre, y_px in zip(izquierdos, ys):
        t = v.por_nombre(nombre)
        ax.scatter([t.coordinates["lng"]], [t.coordinates["lat"]], s=13, color="black", zorder=6, linewidth=0)
        ax.annotate(
            f"{nombre}: {formato(valores[nombre])}", xy=(t.coordinates["lng"], t.coordinates["lat"]),
            xytext=(lng_f(x_der, desplaz), lat_f(y_px)), ha="right", va="center", fontsize=5.95, color="black",
            annotation_clip=False, zorder=7,
            arrowprops=dict(arrowstyle="-", color="#3d3d3d", linewidth=0.5, shrinkA=0, shrinkB=0),
        )
    for nombre in _GRANDES:
        if nombre not in nombres_sel:
            continue
        t = v.por_nombre(nombre)
        dy = 5.5 / -_PX_LAT if sel is None else 0.0
        ax.text(t.coordinates["lng"], t.coordinates["lat"] + dy,
                f"{nombre}\n{formato(valores[nombre])}", ha="center", va="center", fontsize=5.95, linespacing=1.2, zorder=7,
                bbox=dict(boxstyle="square,pad=0.18", facecolor="white", edgecolor="none", alpha=0.78))
    return ax


def _barra_color(fig, izq, der, cmap, norm, ticks, etiqueta, formato):
    cax = ejes_px(fig, izq, 649, der, 688)
    cb = fig.colorbar(ScalarMappable(norm=norm, cmap=cmap), cax=cax, orientation="horizontal")
    cb.set_ticks(ticks)
    cb.ax.xaxis.set_major_formatter(FuncFormatter(lambda x, _p: formato(x)))
    cb.ax.tick_params(length=3.2, width=0.8, labelsize=7, color=TEXTO, labelcolor=TEXTO)
    cb.outline.set_visible(False)
    cb.set_label(etiqueta, fontsize=7.5, color=NEGRO, labelpad=4.2)
    return cb


def figura_2(distritos=None):
    sel = datos.normalizar(distritos)
    v = datos.vista()
    prioridad = {t.name: t.priority for t in v.territorios}
    tiempo = {t.name: t.travel_minutes for t in v.territorios}
    alto = 825 + (0 if sel is None else EXTRA_NOTA)
    fig = lienzo(2094, alto)
    # La escala de color es siempre la de los diez distritos para que los valores sean comparables.
    norma_a = Normalize(0.9 * min(prioridad.values()), max(prioridad.values()))
    norma_b = Normalize(0.9 * min(tiempo.values()), max(tiempo.values()))
    _panel_mapa(fig, 0, prioridad, CMAP_PRIORIDAD, norma_a, lambda x: num(x, 2), sel=sel)
    _panel_mapa(fig, _DESPLAZ_B, tiempo, CMAP_TIEMPO, norma_b, lambda x: f"{x:.0f}", ipress=v.ipress_primer_nivel, sel=sel)
    fig.text(455 / 2094, 1 - 58 / alto, "A. Índice de prioridad territorial", ha="center", va="center", fontsize=10, fontweight="bold")
    fig.text(1554 / 2094, 1 - 58 / alto, "B. Tiempo de viaje a la IPRESS más cercana", ha="center", va="center", fontsize=10, fontweight="bold")
    _barra_color(fig, 80, 882, CMAP_PRIORIDAD, norma_a, [0.1 + 0.025 * i for i in range(9)], "Índice de prioridad (0 a 1)", lambda x: num(round(x, 3)))
    _barra_color(fig, 1043.5, 1846, CMAP_TIEMPO, norma_b, [10, 15, 20, 25, 30, 35, 40], "Tiempo estimado (min)", lambda x: num(x))
    fig.add_artist(Line2D([1094 / 2094], [1 - 589 / alto], marker="^", markersize=3.0, markerfacecolor="white", markeredgecolor="black",
                          markeredgewidth=0.5, linestyle="none", transform=fig.transFigure))
    fig.text(1144 / 2094, 1 - 589 / alto, "IPRESS pública de primer nivel", ha="left", va="center", fontsize=6.5)
    if sel is not None:
        _nota(fig, _texto_seleccion(sel) + ". La escala de color es la de los diez distritos; en gris, los no seleccionados.", alto - 32, 2094, alto)
    elegidos = modelo.seleccionar(v, sel)
    tabla = pd.DataFrame([
        {"distrito": t.name, "indice_prioridad": t.priority, "tiempo_viaje_min": round(t.travel_minutes, 1),
         "latitud": t.coordinates["lat"], "longitud": t.coordinates["lng"]} for t in elegidos
    ]).sort_values("indice_prioridad", ascending=False)
    nombres = {t.name for t in elegidos}
    ipress = pd.DataFrame([
        {"codigo": f["code"], "nombre": f["name"], "distrito": f["districtName"], "categoria": f["category"],
         "institucion": f["institution"], "latitud": f["latitude"], "longitud": f["longitude"]}
        for f in v.ipress_primer_nivel if sel is None or f["districtName"] in nombres
    ])
    return fig, {"distritos": tabla, "ipress_primer_nivel": ipress}


# ----------------------------------------------------------------------------- Figura 3

def _diseno_f3(n: int) -> dict:
    """Tamaño de cada panel y del lienzo según el número de distritos mostrados."""
    columnas = min(n, 5)
    ancho_panel, alto_panel = {1: (1100, 470), 2: (620, 430), 3: (440, 410)}.get(columnas, (331, 403))
    paso = ancho_panel + 107.5
    filas = math.ceil(n / 5)
    return {
        "columnas": columnas, "filas": filas, "ancho_panel": ancho_panel, "alto_panel": alto_panel, "paso": paso,
        "ancho": int(136 + columnas * ancho_panel + (columnas - 1) * 107.5 + 28),
        "alto": int(74 + filas * alto_panel + (filas - 1) * 103 + 237),
    }


def figura_3(distritos=None):
    sel = datos.normalizar(distritos)
    v = datos.vista()
    orden = sorted(modelo.seleccionar(v, sel), key=lambda t: -t.demand)
    n = len(orden)
    d = _diseno_f3(n)
    fig = lienzo(d["ancho"], d["alto"])
    filas = []
    for k, t in enumerate(orden):
        fila, col = divmod(k, 5)
        arriba = 74 + fila * (d["alto_panel"] + 103)
        abajo = arriba + d["alto_panel"]
        izq = 136 + col * d["paso"]
        ax = ejes_px(fig, izq, arriba, izq + d["ancho_panel"], abajo)
        s = modelo.serie_pronostico(t)
        x_obs = [dt.datetime.strptime(m, "%Y-%m") for m in s["meses_obs"]]
        x_fc = [dt.datetime.strptime(m, "%Y-%m") for m in s["meses_fc"]]
        obs = np.array(s["obs"]) / 1000
        fc = np.array(s["fc"]) / 1000
        inf, sup = np.array(s["inf"]) / 1000, np.array(s["sup"]) / 1000
        limpiar_ejes(ax, "y")
        ax.fill_between(x_fc, inf, sup, color=NARANJA, alpha=0.2, linewidth=0, zorder=2)
        ax.plot(x_obs, obs, color=AZUL, lw=1.1, solid_capstyle="round", zorder=3)
        ax.plot([x_obs[-1]] + x_fc, [obs[-1]] + list(fc), color=NARANJA, lw=1.1, linestyle=(0, (2.7, 1.6)), zorder=3)
        ax.set_ylim(bottom=0)
        ax.yaxis.set_major_locator(MaxNLocator(nbins=7, steps=[1, 2, 2.5, 5, 10]))
        ultima_fila = (k + 5 >= n)  # no hay otro panel debajo
        ax.tick_params(labelsize=5.75, labelbottom=ultima_fila)
        ax.set_title(ABREVIATURAS.get(t.name, t.name), loc="left", fontsize=7.5, pad=6)
        ax.yaxis.set_major_formatter(formateador())
        ticks = [dt.datetime(a, 1, 1) for a in (2024, 2025, 2026)]
        ax.xaxis.set_major_locator(FixedLocator(mdates.date2num(ticks)))
        ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, _p: f"{MESES_ES[mdates.num2date(x).month - 1]}\n{mdates.num2date(x).year}"))
        if col == 0:
            ax.set_ylabel("Miles de consultas", fontsize=7)
        for m, o in zip(s["meses_obs"], s["obs"]):
            filas.append({"distrito": t.name, "mes": m, "tipo": "Observado (SIS)", "consultas": o, "inferior90": None, "superior90": None})
        for m, f, lo, hi in zip(s["meses_fc"], s["fc"], s["inf"], s["sup"]):
            filas.append({"distrito": t.name, "mes": m, "tipo": "Pronóstico estacional", "consultas": f, "inferior90": lo, "superior90": hi})
    handles = [
        Line2D([], [], color=AZUL, lw=1.6, label="Observado (SIS)"),
        Line2D([], [], color=NARANJA, lw=1.6, linestyle=(0, (2.7, 1.6)), label="Pronóstico estacional"),
        Patch(facecolor=NARANJA, alpha=0.2, label="Banda empírica del 90 %"),
    ]
    ancho_ok = d["ancho"] >= 1500
    y_leyenda = d["alto"] - (1220 - 1162)
    fig.legend(handles=handles, loc="center", ncol=3, bbox_to_anchor=(0.5, 1 - y_leyenda / d["alto"]),
               handlelength=2.1 if ancho_ok else 1.8, columnspacing=2.0 if ancho_ok else 1.4, handletextpad=0.8,
               fontsize=7 if ancho_ok else 6.4)
    if sel is not None:
        _nota(fig, _texto_seleccion(sel), d["alto"] - 22, d["ancho"], d["alto"])
    return fig, pd.DataFrame(filas)


# ----------------------------------------------------------------------------- Figura 4

INTERVENCIONES_ES = {
    "new_facility": "Nueva IPRESS",
    "expand_capacity": "Ampliación",
    "improve_access": "Mejora de\nacceso",
    "temporary_closure": "Cierre\ntemporal",
}


def figura_4(distritos=None):
    sel = datos.normalizar(distritos)
    v = datos.vista()
    filas = modelo.matriz_intervenciones(v, sel)
    n = len(filas)
    valores = np.array([[f[k] for k in INTERVENCIONES_ES] for f in filas])
    alto_celda = 1011 / 10 if n >= 6 else (140.0 if n >= 3 else 180.0)
    alto_mapa = n * alto_celda
    alto_fig = int(32 + alto_mapa + 110 + (0 if sel is None else 30))
    fig = lienzo(2087, alto_fig)
    ax = ejes_px(fig, 466, 32, 1816, 32 + alto_mapa)
    malla = ax.pcolormesh(valores, cmap=CMAP_CAMBIO, vmin=-0.22, vmax=0.22, edgecolors="white", linewidth=1.6)
    ax.set_xlim(0, valores.shape[1])
    ax.set_ylim(valores.shape[0], 0)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.set_xticks(np.arange(valores.shape[1]) + 0.5)
    ax.set_xticklabels(list(INTERVENCIONES_ES.values()), fontsize=7.5, color=TEXTO, linespacing=1.25)
    ax.set_yticks(np.arange(valores.shape[0]) + 0.5)
    ax.set_yticklabels([f"{f['distrito']} ({num(f['prioridad_basal'], 2)})" for f in filas], fontsize=7.5, color=TEXTO)
    ax.tick_params(length=0, pad=3.5)
    for i in range(valores.shape[0]):
        for j in range(valores.shape[1]):
            r, g, b, _ = CMAP_CAMBIO((valores[i, j] + 0.22) / 0.44)
            brillo = (0.299 * r + 0.587 * g + 0.114 * b) * 255
            ax.text(j + 0.5, i + 0.5, num(valores[i, j], 2, signo=True), ha="center", va="center", fontsize=7.5,
                    color="white" if brillo < 145 else NEGRO)
    cax = ejes_px(fig, 1848, 30, 1900, 32 + alto_mapa + 1)
    cb = fig.colorbar(malla, cax=cax)
    paso = 0.05 if alto_mapa >= 600 else 0.1
    cb.set_ticks(list(np.round(np.arange(-0.2, 0.2001, paso), 2)))
    cb.ax.yaxis.set_major_formatter(formateador())
    cb.ax.tick_params(labelsize=6.5, labelcolor=TEXTO, color=TEXTO, length=3)
    cb.outline.set_visible(False)
    etiqueta = "Cambio en el índice de prioridad" if alto_mapa >= 600 else "Cambio en el índice\nde prioridad"
    cb.set_label(etiqueta, fontsize=7.5, color=NEGRO, labelpad=5)
    if sel is not None:
        _nota(fig, _texto_seleccion(sel), alto_fig - 14, 2087, alto_fig)
    return fig, pd.DataFrame(filas)


# ----------------------------------------------------------------------------- Figura S1

def figura_s1(distritos=None):
    sel = datos.normalizar(distritos)
    r = datos.validacion_temporal(sel)
    resumen, mae = r["resumen"], r["mae_pliegues"]
    alto = 949 + (0 if sel is None else EXTRA_NOTA)
    fig = lienzo(2256, alto)
    axA = ejes_px(fig, 461, 80, 1193, 745)
    axB = ejes_px(fig, 1566, 80, 2202, 745)

    limpiar_ejes(axA, "x")
    nombres = list(resumen["Modelo"])
    tope = float(mae.values.max())
    desplazamiento = 22 if sel is None else tope * 0.03
    for i, nombre in enumerate(nombres):
        vals = mae[nombre].values
        axA.scatter(vals, [i] * len(vals), s=21, color=AZUL_CLARO, edgecolor="white", linewidth=0.5, zorder=3)
        media = vals.mean()
        axA.scatter([media], [i], marker="D", s=62, color=AZUL, edgecolor="white", linewidth=0.6, zorder=4)
        axA.text(vals.max() + desplazamiento, i, num(media, 1), va="center", ha="left", fontsize=7)
    if sel is None:
        axA.set_xlim(200, 1000)
        axA.set_xticks(range(200, 1001, 100))
    else:
        axA.set_xlim(0, tope * 1.2)
        axA.xaxis.set_major_locator(MaxNLocator(nbins=8))
    axA.set_ylim(len(nombres) - 0.8, -0.22)
    axA.set_yticks(range(len(nombres)))
    axA.set_yticklabels(nombres)
    axA.set_xlabel("MAE por pliegue (consultas por mes)", labelpad=5)
    axA.set_title("A. Error absoluto medio en validación temporal", loc="left", pad=6)
    axA.xaxis.set_major_formatter(formateador())
    handles = [
        Line2D([], [], marker="o", color="none", markerfacecolor=AZUL_CLARO, markeredgecolor="white", markersize=6.5, label="Pliegue"),
        Line2D([], [], marker="D", color="none", markerfacecolor=AZUL, markeredgecolor="white", markersize=8.7, label="Media"),
    ]
    fig.legend(handles=handles, loc="center", ncol=2, bbox_to_anchor=(827 / 2256, 1 - 894 / alto), columnspacing=2.0,
               handletextpad=0.5, fontsize=6.5)

    imp = r["importancias"]
    limpiar_ejes(axB, "x")
    y = np.arange(len(imp))
    axB.barh(y, imp.values, height=0.6, color=AZUL, zorder=3)
    for yi, val in zip(y, imp.values):
        axB.text(val + 0.008, yi, num(val, 3), va="center", ha="left", fontsize=6.9)
    axB.set_xlim(0, 0.6)
    axB.set_ylim(len(imp) - 0.2, -0.88)
    axB.set_yticks(y)
    axB.set_yticklabels(imp.index)
    axB.set_xticks(np.arange(0, 0.61, 0.1))
    axB.xaxis.set_major_formatter(formateador())
    axB.set_xlabel("Importancia relativa (reducción de impureza)", labelpad=5)
    axB.set_title("B. Importancia de variables", loc="left", pad=6)
    if sel is not None:
        _nota(fig, _texto_seleccion(sel) + ". Panel A: error medido solo en esos distritos, con modelos entrenados con los diez. "
              "Panel B: importancia del modelo ajustado con los diez distritos.", alto - 32, 2256, alto)

    tabla_a = mae.melt(var_name="modelo", value_name="mae").assign(pliegue=lambda d: d.groupby("modelo").cumcount() + 1)
    tabla_b = imp.rename("importancia").rename_axis("variable").reset_index()
    return fig, {"panel_A_mae_por_pliegue": tabla_a, "panel_B_importancia_variables": tabla_b}


# ----------------------------------------------------------------------------- Figura S2

ETIQUETAS_INDICADORES = {
    "accessDeficit": "Déficit de accesibilidad", "travelMinutes": "Tiempo de viaje",
    "pressure": "Presión asistencial", "facilitiesPer10k": "IPRESS por 10.000 hab.",
}


def figura_s2(distritos=None):
    sel = datos.normalizar(distritos)
    v = datos.vista()
    quintiles = modelo.valores_por_quintil(v, sel)
    conc = modelo.tabla_concentracion(v, distritos=sel)
    alto = 960 + (0 if sel is None else EXTRA_NOTA)
    fig = lienzo(2257, alto)
    axA = ejes_px(fig, 143, 80, 967, 808)
    axB = ejes_px(fig, 1381, 80, 2204, 808)

    limpiar_ejes(axA, "y")
    x = np.arange(5)
    tiempos = [q["tiempo_viaje_min"] for q in quintiles]
    ipress = [q["ipress_por_100k"] for q in quintiles]
    b1 = axA.bar(x - 0.18, tiempos, 0.36, color=AZUL, zorder=3, label="Tiempo de viaje (min)")
    b2 = axA.bar(x + 0.18, ipress, 0.36, color=NARANJA, zorder=3, label="IPRESS con actividad SIS por 100.000 hab.")
    for xi, val in zip(x - 0.18, tiempos):
        if val == val:
            axA.text(xi, val + 0.2, num(val, 1), ha="center", va="bottom", fontsize=6.3)
    for xi, val in zip(x + 0.18, ipress):
        if val == val:
            axA.text(xi, val + 0.2, num(val, 1), ha="center", va="bottom", fontsize=6.3)
    axA.set_xlim(-0.6, 4.6)
    axA.set_ylim(0, np.nanmax(tiempos + ipress) * 1.25 if sel is not None else max(tiempos) * 1.25)
    if sel is None:
        axA.set_yticks(range(0, 31, 5))
    else:
        axA.yaxis.set_major_locator(MaxNLocator(nbins=6))
    axA.set_xticks(x)
    axA.set_xticklabels(["Q1\nmenor\npobreza", "Q2", "Q3", "Q4", "Q5\nmayor\npobreza"], linespacing=1.15)
    axA.yaxis.set_major_formatter(formateador())
    axA.set_ylabel("Valor ponderado por población", labelpad=5)
    axA.set_title("A. Indicadores por quintil de pobreza", loc="left", pad=6)
    axA.legend(handles=[b1, b2], loc="upper left", bbox_to_anchor=(0.18, 1.0), handlelength=2.0, labelspacing=0.55,
               borderaxespad=0.2, fontsize=6.25)

    if conc:
        limpiar_ejes(axB, "x")
        for i, fila in enumerate(conc):
            axB.plot([fila["ciLow"], fila["ciHigh"]], [i, i], color="#86b6ef", lw=2.1, solid_capstyle="round", zorder=3)
            axB.scatter([fila["concentration"]], [i], s=34, color=AZUL, edgecolor="white", linewidth=0.6, zorder=4)
            axB.text(fila["ciHigh"] + 0.012, i, f"{num(fila['concentration'], 3)} [{num(fila['ciLow'], 3)}; {num(fila['ciHigh'], 3)}]",
                     va="center", ha="left", fontsize=6.3)
        axB.axvline(0, color=TEXTO, lw=0.9, linestyle=":", zorder=2)
        axB.set_ylim(-0.16, 3.16)
        if sel is None:
            axB.set_xlim(-0.3, 0.6)
            axB.set_xticks(np.round(np.arange(-0.3, 0.61, 0.1), 1))
        else:
            lim_bajo = min(min(f["ciLow"] for f in conc), 0.0)
            lim_alto = max(max(f["ciHigh"] for f in conc), 0.0)
            minimo = lim_bajo - 0.08 * (lim_alto - lim_bajo)
            axB.set_xlim(minimo, (lim_alto + 0.012 - 0.4 * minimo) / 0.6)
            axB.xaxis.set_major_locator(MaxNLocator(nbins=8))
        axB.xaxis.set_major_formatter(formateador())
        axB.set_yticks(range(4))
        axB.set_yticklabels([ETIQUETAS_INDICADORES[f["indicator"]] for f in conc])
        axB.set_xlabel("Índice de concentración (IC 95 % bootstrap)", labelpad=5)
    else:
        _mensaje(axB, "El índice de concentración requiere al menos tres distritos. Agregue más distritos al filtro.")
    axB.set_title("B. Concentración según pobreza", loc="left", pad=6)
    if sel is not None:
        _nota(fig, _texto_seleccion(sel) + ". El quintil de pobreza se define con los diez distritos; "
              "los intervalos con pocos distritos son poco informativos.", alto - 32, 2257, alto)

    tabla_a = pd.DataFrame(quintiles)
    tabla_b = (pd.DataFrame(conc).assign(indicador=lambda d: d["indicator"].map(ETIQUETAS_INDICADORES)).drop(columns="indicator")
               if conc else pd.DataFrame({"mensaje": ["Se requieren al menos tres distritos"]}))
    return fig, {"panel_A_quintiles": tabla_a, "panel_B_concentracion": tabla_b}


# ----------------------------------------------------------------------------- Figura S3

def figura_s3(distritos=None):
    sel = datos.normalizar(distritos)
    if sel is not None and len(sel) < 2:
        fig = lienzo(2244, 940)
        ax = fig.add_axes([0.1, 0.1, 0.8, 0.8])
        _mensaje(ax, "La sensibilidad del ranking compara distritos entre sí: seleccione al menos dos.")
        return fig, {"mensaje": pd.DataFrame({"mensaje": ["Se requieren al menos dos distritos"]})}
    sens = datos.sensibilidad(sel)
    alto = 940 + (0 if sel is None else EXTRA_NOTA)
    fig = lienzo(2244, alto)
    axA = ejes_px(fig, 142, 78, 1079, 722)
    axB = ejes_px(fig, 1267, 78, 2205, 722)

    limpiar_ejes(axA, "y")
    colores = {20: AZUL_CLARO, 50: AZUL_MEDIO, 100: MARINO}
    minimo = min(float(sens[a]["tau"].min()) for a in datos.ALFAS)
    inferior = 0.5 if minimo >= 0.5 else math.floor(minimo * 50) / 50
    bins = np.linspace(inferior, 1.0, int(round((1.0 - inferior) / 0.02)) + 1)
    for alfa in datos.ALFAS:
        d = sens[alfa]
        axA.hist(d["tau"], bins=bins, density=True, histtype="step", color=colores[alfa], linewidth=1.6,
                 label=f"α = {alfa} (media {num(d['tau_media'], 3)})")
    if sel is None:
        axA.set_xticks(np.round(np.arange(0.5, 1.01, 0.1), 1))
        axA.set_yticks([0, 5, 10, 15, 20])
    else:
        axA.xaxis.set_major_locator(MaxNLocator(nbins=6))
        axA.yaxis.set_major_locator(MaxNLocator(nbins=5))
    axA.xaxis.set_major_formatter(formateador())
    axA.yaxis.set_major_formatter(formateador())
    axA.set_ylabel("Densidad", labelpad=5)
    axA.set_xlabel("Tau de Kendall frente al ranking base", labelpad=5)
    axA.set_title("A. Concordancia del ranking", loc="left", pad=6)
    axA.legend(loc="upper left", bbox_to_anchor=(0.0, 1.0), handlelength=2.1, labelspacing=0.6, borderaxespad=0.4, fontsize=6.6)

    limpiar_ejes(axB, None)
    base = sens[datos.ALFAS[0]]["distrito_base"]
    acumulado: dict[str, float] = {}
    for alfa in datos.ALFAS:
        for nombre, p in sens[alfa]["primer_lugar"].items():
            if nombre != base:
                acumulado[nombre] = acumulado.get(nombre, 0.0) + p
    otros = sorted(acumulado, key=lambda n: -acumulado[n])
    rival = otros[0] if otros else None
    resto = otros[1:]
    hay_otros = bool(resto) and max(sum(sens[a]["primer_lugar"].get(n, 0.0) for n in resto) for a in datos.ALFAS) >= 0.005
    for k, alfa in enumerate(datos.ALFAS):
        pl = sens[alfa]["primer_lugar"]
        a = pl.get(base, 0.0)
        b = pl.get(rival, 0.0) if rival else 0.0
        c = sum(pl.get(n, 0.0) for n in resto) if hay_otros else 0.0
        axB.barh(k, a, height=0.53, color=AZUL, edgecolor="white", linewidth=1.0, zorder=3)
        axB.text(a / 2, k, f"{a * 100:.0f} %", color="white", ha="center", va="center", fontsize=6.9, zorder=4)
        if rival and b > 0:
            axB.barh(k, b, left=a, height=0.53, color=NARANJA, edgecolor="white", linewidth=1.0, zorder=3)
            axB.text(a + b / 2, k, f"{b * 100:.0f} %", color="white", ha="center", va="center", fontsize=6.9, zorder=4)
        if c > 0:
            axB.barh(k, c, left=a + b, height=0.53, color="#9ca3af", edgecolor="white", linewidth=1.0, zorder=3)
            if c >= 0.04:
                axB.text(a + b + c / 2, k, f"{c * 100:.0f} %", color="white", ha="center", va="center", fontsize=6.9, zorder=4)
    axB.set_xlim(0, 1)
    axB.set_ylim(-0.4, 2.4)
    axB.set_yticks(range(3))
    axB.set_yticklabels([f"α = {a}" for a in datos.ALFAS])
    axB.set_xticks(np.round(np.arange(0, 1.01, 0.2), 1))
    axB.xaxis.set_major_formatter(formateador())
    axB.set_xlabel("Proporción de simulaciones", labelpad=5)
    axB.set_title("B. Distrito situado en primer lugar", loc="left", pad=6)
    leyenda = [Patch(facecolor=AZUL, label=base)]
    if rival:
        leyenda.append(Patch(facecolor=NARANJA, label=rival))
    if hay_otros:
        leyenda.append(Patch(facecolor="#9ca3af", label="Otros"))
    fig.legend(handles=leyenda, loc="center", ncol=len(leyenda), bbox_to_anchor=(1736 / 2244, 1 - 886 / alto),
               handlelength=1.7, columnspacing=2.6, fontsize=6.4)
    if sel is not None:
        _nota(fig, _texto_seleccion(sel) + ". El ranking base y el primer lugar se calculan solo entre estos distritos.", alto - 32, 2244, alto)

    tabla_a = pd.DataFrame({f"tau_alfa_{a}": sens[a]["tau"] for a in datos.ALFAS})
    tabla_b = pd.DataFrame([
        {"alfa": a, "distrito": d, "proporcion": p} for a in datos.ALFAS for d, p in sens[a]["primer_lugar"].items()
    ])
    return fig, {"panel_A_tau_por_sorteo": tabla_a, "panel_B_primer_lugar": tabla_b}

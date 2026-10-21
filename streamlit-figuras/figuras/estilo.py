"""Estilo común de las figuras del artículo (colores, fuentes y formato numérico en español)."""

from __future__ import annotations

import matplotlib

matplotlib.use("Agg")

from decimal import ROUND_HALF_UP, Decimal

import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.ticker import FuncFormatter

DPI = 300

AZUL = "#2a78d6"
NARANJA = "#eb6834"
AZUL_CLARO = "#9ec5f4"
AZUL_MEDIO = "#4488db"
MARINO = "#104281"
BANDA = "#fbe0d6"
GRILLA = "#eae9e6"
EJE = "#8a8984"
TEXTO = "#52514e"
NEGRO = "#000000"

MESES_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

# Paradas muestreadas de las barras de color del artículo.
_AZULES = ["#cde2fb", "#b7d4f7", "#a0c6f3", "#8ab9f0", "#72aaec", "#5a9be9", "#428de6", "#3581de", "#2f78d2",
           "#296fc6", "#2365b8", "#1c59a4", "#154c91", "#104180", "#0f3e79", "#0e3a72", "#0d366b"]
_NARANJAS = ["#fde3d6", "#fbd6c4", "#f9c9b2", "#f8bda1", "#f6b08f", "#f39e78", "#f18d62", "#ee7b4c", "#eb6935",
             "#df602d", "#d25825", "#c54f1e", "#b84716", "#a94013", "#993a11", "#8a330e", "#7a2c0b"]
# De +máximo (rojo) a -máximo (azul); se invierte para que el azul quede abajo en la barra.
_DIVERGENTE = ["#b52a29", "#be3938", "#c84a48", "#d35a59", "#dc6968", "#e67a78", "#ef8987", "#f09a98", "#f0aca9",
               "#f0bcb9", "#f0cdca", "#f0dedc", "#f0eeeb", "#dae3ec", "#c4d7ec", "#afcbec", "#99bfec", "#82b3ec",
               "#6ea7ec", "#5f9ae1", "#518dd6", "#4582cc", "#3775c0", "#2a69b6", "#1c5cab"]

CMAP_PRIORIDAD = LinearSegmentedColormap.from_list("prioridad", _AZULES)
CMAP_TIEMPO = LinearSegmentedColormap.from_list("tiempo", _NARANJAS)
CMAP_CAMBIO = LinearSegmentedColormap.from_list("cambio", _DIVERGENTE[::-1])


def aplicar_estilo() -> None:
    plt.rcParams.update({
        "font.family": "DejaVu Sans",
        "font.size": 7.5,
        "axes.titlesize": 8.5,
        "axes.titleweight": "bold",
        "axes.labelsize": 7.5,
        "axes.labelcolor": NEGRO,
        "axes.edgecolor": EJE,
        "axes.linewidth": 0.8,
        "xtick.color": EJE,
        "ytick.color": EJE,
        "xtick.labelcolor": TEXTO,
        "ytick.labelcolor": TEXTO,
        "xtick.labelsize": 7,
        "ytick.labelsize": 7,
        "legend.fontsize": 7,
        "legend.frameon": False,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.axisbelow": True,
        "svg.fonttype": "none",
        "pdf.fonttype": 42,
    })


aplicar_estilo()


def num(valor: float, decimales: int | None = None, signo: bool = False) -> str:
    """Formato numérico en español: coma decimal y signo menos tipográfico."""
    if valor == 0:  # evita "−0"
        valor = 0.0
    if decimales is None:
        texto = f"{valor:g}"
    else:  # la mitad se redondea hacia arriba, como en el artículo (0,05 pasa a 0,1)
        texto = str(Decimal(repr(float(valor))).quantize(Decimal(1).scaleb(-decimales), rounding=ROUND_HALF_UP))
    if signo and valor > 0 and not texto.startswith("+"):
        texto = "+" + texto
    return texto.replace(".", ",").replace("-", "−")


def formateador(decimales: int | None = None) -> FuncFormatter:
    return FuncFormatter(lambda v, _pos: num(v, decimales))


def lienzo(ancho_px: int, alto_px: int):
    """Figura con el tamaño en píxeles de la imagen original (300 dpi)."""
    return plt.figure(figsize=(ancho_px / DPI, alto_px / DPI), dpi=DPI, facecolor="white")


def ejes_px(fig, izq: float, arriba: float, der: float, abajo: float, **kw):
    """Ejes a partir de un recuadro en píxeles medidos desde la esquina superior izquierda."""
    ancho, alto = fig.get_size_inches() * DPI
    return fig.add_axes([izq / ancho, 1 - abajo / alto, (der - izq) / ancho, (abajo - arriba) / alto], **kw)


def limpiar_ejes(ax, grilla: str | None = "y") -> None:
    for lado in ("top", "right"):
        ax.spines[lado].set_visible(False)
    if grilla:
        ax.grid(axis=grilla, color=GRILLA, linewidth=0.8)
    ax.tick_params(length=3, width=0.8)

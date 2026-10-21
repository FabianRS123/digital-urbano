"""Catálogo de las figuras del artículo con datos: título, pie, qué demuestra y constructor."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from . import construir

ASSETS = construir.ASSETS_WORD

FUENTE_COMPLETA = (
    "Elaboración propia con base en datos del Seguro Integral de Salud (SIS), RENIPRESS (SUSALUD), "
    "Instituto Nacional de Estadística e Informática (INEI) y límites censales PCM/INEI."
)


@dataclass(frozen=True)
class Figura:
    clave: str
    etiqueta: str
    titulo: str
    que_demuestra: str
    pie: str
    fuente: str
    constructor: Callable
    imagen_word: Path
    icono: str
    filtra: str  # cómo responde al filtro de ubicación (texto breve para la interfaz)
    dpi: int = 300

    @property
    def nombre_archivo(self) -> str:
        return self.imagen_word.stem


FIGURAS: list[Figura] = [
    Figura(
        "f2", "Figura 2", "Prioridad territorial y tiempo de viaje",
        "La prioridad más alta se ubica en la periferia (Salaverry, Poroto y Laredo), justo donde el tiempo "
        "de viaje a la IPRESS pública de primer nivel es mayor.",
        "Índice de prioridad territorial (A) y tiempo de viaje referencial a la IPRESS pública de primer nivel "
        "más cercana (B) por distrito, Trujillo metropolitano, Perú, diciembre de 2025.",
        FUENTE_COMPLETA, construir.figura_2, ASSETS / "figura2_prioridad_tiempo.png", ":material/map:",
        "El mapa se acerca a los distritos elegidos y deja el resto en gris.",
    ),
    Figura(
        "f3", "Figura 3", "Consultas SIS y pronóstico estacional",
        "Serie mensual observada de 2024 a 2025 y pronóstico de enero a junio de 2026 con banda empírica del 90 %, "
        "que resulta más ancha en los distritos pequeños y volátiles.",
        "Consultas externas mensuales de asegurados SIS observadas entre enero de 2024 y diciembre de 2025 y "
        "pronóstico estacional con banda empírica del 90 % para enero a junio de 2026, por distrito, "
        "Trujillo metropolitano, Perú.",
        "Elaboración propia con base en datos del Seguro Integral de Salud (SIS).", construir.figura_3,
        ASSETS / "figura3_pronostico.png", ":material/show_chart:",
        "Se muestra un panel por cada distrito elegido.",
    ),
    Figura(
        "f4", "Figura 4", "Efecto simulado de cada intervención",
        "Abrir una IPRESS baja la prioridad (hasta 0,14 puntos en Poroto), mientras que el cierre temporal la "
        "sube entre 0,17 y 0,20 en todos los distritos.",
        "Cambio simulado en el índice de prioridad del distrito intervenido según tipo de intervención, Trujillo "
        "metropolitano, Perú, escenario base de diciembre de 2025.",
        FUENTE_COMPLETA + " Entre paréntesis, prioridad basal.", construir.figura_4,
        ASSETS / "figura4_intervenciones.png", ":material/grid_on:",
        "Se muestran solo las filas de los distritos elegidos, con la misma escala de color.",
    ),
    Figura(
        "s1", "Figura S1", "Modelos de pronóstico e importancia de variables",
        "Ningún modelo supera con claridad a la persistencia simple, y el rezago de un mes concentra casi la "
        "mitad de la importancia (0,491): el modelo aprende sobre todo la inercia de la serie.",
        "Error absoluto medio por pliegue de los modelos de pronóstico (A) e importancia de variables del modelo "
        "de potenciación de gradiente (B), Trujillo metropolitano, Perú, marzo a diciembre de 2025.",
        "Elaboración propia con base en datos del Seguro Integral de Salud (SIS) e INEI.", construir.figura_s1,
        ASSETS / "figuraS1_modelos.png", ":material/model_training:",
        "El error (panel A) se mide solo en los distritos elegidos; la importancia (panel B) es la del modelo con los diez.",
    ),
    Figura(
        "s2", "Figura S2", "Quintiles de pobreza e índices de concentración",
        "Los índices de concentración son levemente positivos pero sus intervalos incluyen el cero, y el mayor "
        "tiempo de viaje no está en el quintil más pobre sino en el segundo.",
        "Tiempo de viaje e IPRESS con actividad SIS por quintil de pobreza (A) e índices de concentración según "
        "pobreza (B), Trujillo metropolitano, Perú, diciembre de 2025.",
        FUENTE_COMPLETA, construir.figura_s2, ASSETS / "figuraS2_quintiles.png", ":material/balance:",
        "Los promedios y los índices se calculan solo con los distritos elegidos (el índice requiere al menos tres).",
    ),
    Figura(
        "s3", "Figura S3", "Sensibilidad del ranking a los pesos",
        "El ordenamiento es estable ante cambios en los pesos (tau de 0,93 a 0,97) y el primer lugar solo "
        "alterna entre Salaverry y Poroto, dos distritos con prioridad muy parecida.",
        "Concordancia del ranking de prioridad (A) y distrito ubicado en primer lugar (B) ante 10.000 "
        "perturbaciones de pesos por concentración de Dirichlet, Trujillo metropolitano, Perú, diciembre de 2025.",
        FUENTE_COMPLETA, construir.figura_s3, ASSETS / "figuraS3_sensibilidad.png", ":material/shuffle:",
        "El ranking y el primer lugar se calculan solo entre los distritos elegidos (mínimo dos).",
    ),
]

POR_CLAVE = {f.clave: f for f in FIGURAS}

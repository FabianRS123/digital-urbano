"""Tablas del artículo que se derivan de los datos (2, 3, S2, S3 y S4), con el formato del Word.

Cada tabla devuelve una versión para mostrar (texto con coma decimal, como en el manuscrito) y otra numérica
para exportar. Las tablas 2, 3 y S2 aceptan la selección de distritos.
"""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from . import datos, modelo
from .catalogo import FUENTE_COMPLETA
from .estilo import num

RESULTADOS = datos.SNAPSHOT_PATH.parents[1] / "research" / "results"


@dataclass
class Tabla:
    clave: str
    etiqueta: str
    titulo: str
    mostrar: pd.DataFrame
    exportar: pd.DataFrame
    nota: str = ""
    fuente: str = FUENTE_COMPLETA
    filtrable: bool = False
    avisos: list[str] = field(default_factory=list)


def miles(valor: float) -> str:
    return f"{valor:,.0f}".replace(",", ".")


def _con_miles(valor: float, decimales: int) -> str:
    return f"{valor:,.{decimales}f}".replace(",", "§").replace(".", ",").replace("§", ".")


def _par(media: float, de: float, decimales: int, miles_: bool = False) -> str:
    if miles_:
        return f"{_con_miles(media, decimales)} ({_con_miles(de, decimales)})"
    return f"{num(media, decimales)} ({num(de, decimales)})"


# ------------------------------------------------------------------ Tabla 2

def tabla_2(distritos=None) -> Tabla:
    sel = datos.normalizar(distritos)
    v = datos.vista()
    filas = sorted(modelo.seleccionar(v, sel), key=lambda t: -t.priority)
    crudo = pd.DataFrame([{
        "Distrito": t.name, "Población 2025": t.population, "Pobreza (%)": round(t.poverty * 100, 1), "IPRESS": t.n_operativas,
        "Consultas SIS": t.demand, "Capacidad de referencia": t.capacity, "Presión": round(t.pressure, 2),
        "Tiempo (min)": round(t.travel_minutes, 1), "Acceso (A)": round(t.access, 2), "Prioridad": t.priority,
    } for t in filas])
    poblacion = sum(t.population for t in filas)
    total = {
        "Distrito": "Total" if sel is None else "Total (selección)", "Población 2025": poblacion,
        "Pobreza (%)": round(sum(t.poverty * t.population for t in filas) / poblacion * 100, 1),
        "IPRESS": sum(t.n_operativas for t in filas), "Consultas SIS": sum(t.demand for t in filas),
        "Capacidad de referencia": sum(t.capacity for t in filas),
        "Presión": round(sum(t.demand for t in filas) / sum(t.capacity for t in filas), 2),
        "Tiempo (min)": np.nan, "Acceso (A)": np.nan, "Prioridad": np.nan,
    }
    exportar = pd.concat([crudo, pd.DataFrame([total])], ignore_index=True)
    mostrar = pd.DataFrame({
        "Distrito": exportar["Distrito"],
        "Población 2025": exportar["Población 2025"].map(miles),
        "Pobreza (%)": exportar["Pobreza (%)"].map(lambda x: num(x, 1)),
        "IPRESS": exportar["IPRESS"].map(miles),
        "Consultas SIS": exportar["Consultas SIS"].map(miles),
        "Capacidad de referencia": exportar["Capacidad de referencia"].map(miles),
        "Presión": exportar["Presión"].map(lambda x: num(x, 2)),
        "Tiempo (min)": exportar["Tiempo (min)"].map(lambda x: "n.c." if x != x else num(x, 1)),
        "Acceso (A)": exportar["Acceso (A)"].map(lambda x: "n.c." if x != x else num(x, 2)),
        "Prioridad": exportar["Prioridad"].map(lambda x: "n.c." if x != x else num(x, 2)),
    })
    return Tabla(
        "t2", "Tabla 2", "Caracterización basal de los distritos según componentes del índice de prioridad, "
        "Trujillo metropolitano, Perú, diciembre de 2025.", mostrar, exportar,
        nota="n.c.: no corresponde. La pobreza total está ponderada por población.", filtrable=True,
    )


# ------------------------------------------------------------------ Tabla 3

def tabla_3(distritos=None) -> Tabla:
    sel = datos.normalizar(distritos)
    r = datos.validacion_temporal(sel)
    res = r["resumen"].sort_values(["Rango medio", "MAE"]).reset_index(drop=True)
    exportar = res.rename(columns={
        "MAE DE": "MAE (DE)", "RMSE DE": "RMSE (DE)", "MAPE DE": "MAPE % (DE)", "R2 DE": "R² (DE)", "R2": "R²",
        "MAPE": "MAPE %",
    }).round(4)
    mostrar = pd.DataFrame({
        "Modelo": res["Modelo"],
        "MAE (DE)": [_par(a, b, 1, True) for a, b in zip(res["MAE"], res["MAE DE"])],
        "RMSE (DE)": [_par(a, b, 1, True) for a, b in zip(res["RMSE"], res["RMSE DE"])],
        "MAPE % (DE)": [_par(a, b, 1) for a, b in zip(res["MAPE"], res["MAPE DE"])],
        "R² (DE)": [_par(a, b, 3) for a, b in zip(res["R2"], res["R2 DE"])],
        "Rango medio": res["Rango medio"].map(lambda x: num(x, 1)),
    })
    chi, p_f = r["friedman"]
    w, p_w = r["wilcoxon"]
    nota = ("MAE: error absoluto medio; RMSE: raíz del error cuadrático medio; MAPE: error porcentual absoluto medio; "
            "DE: desviación estándar entre pliegues; rango medio según MAE (1 = mejor). "
            f"Prueba de Friedman: χ² = {num(chi, 2)}; p = {num(p_f, 3)}. "
            f"Wilcoxon, potenciación de gradiente frente a persistencia estacional: W = {num(w, 0)}; p = {num(p_w, 3)}.")
    avisos = []
    if sel is not None:
        avisos.append("Los modelos se entrenan con los diez distritos y el error se mide solo en los distritos elegidos; "
                      "con pocos distritos las desviaciones y el R² son poco informativos.")
    return Tabla(
        "t3", "Tabla 3", "Desempeño de los modelos de pronóstico de consultas externas SIS en validación cruzada temporal "
        "de cinco pliegues, Trujillo metropolitano, Perú, marzo a diciembre de 2025.", mostrar, exportar, nota=nota,
        fuente="Elaboración propia con base en datos del Seguro Integral de Salud (SIS) e INEI.", filtrable=True, avisos=avisos,
    )


# ------------------------------------------------------------------ Tabla S2

_INDICADORES = {
    "accessDeficit": ("Déficit de accesibilidad", 3),
    "travelMinutes": ("Tiempo de viaje (min)", 1),
    "pressure": ("Presión asistencial", 3),
    "facilitiesPer10k": ("IPRESS con actividad SIS por 10.000 hab.", 2),
}


def tabla_s2(distritos=None) -> Tabla:
    sel = datos.normalizar(distritos)
    filas = modelo.tabla_concentracion(datos.vista(), distritos=sel)
    nota = ("Índice ponderado por población y ordenado de menor a mayor pobreza; un valor positivo indica concentración "
            "en la población más pobre. Intervalos de 5.000 réplicas bootstrap de distritos. Quintil 1: menor pobreza; "
            "quintil 5: mayor pobreza.")
    if not filas:
        vacio = pd.DataFrame({"Aviso": ["El índice de concentración requiere al menos tres distritos."]})
        return Tabla("ts2", "Tabla S2", "Índices de concentración de indicadores de acceso, presión y oferta según pobreza distrital, "
                     "Trujillo metropolitano, Perú, diciembre de 2025.", vacio, vacio, nota=nota, filtrable=True)
    exportar = pd.DataFrame([{
        "Indicador": _INDICADORES[f["indicator"]][0], "Índice de concentración": round(f["concentration"], 4),
        "IC 95 % inferior": round(f["ciLow"], 4), "IC 95 % superior": round(f["ciHigh"], 4),
        "Quintil 1": round(f["q1"], 4), "Quintil 5": round(f["q5"], 4),
        "Razón Q5/Q1": None if f["q5OverQ1"] is None else round(f["q5OverQ1"], 3),
    } for f in filas])
    mostrar = pd.DataFrame([{
        "Indicador": _INDICADORES[f["indicator"]][0],
        "Índice de concentración": num(f["concentration"], 3),
        "IC 95 % bootstrap": f"{num(f['ciLow'], 3)}; {num(f['ciHigh'], 3)}",
        "Quintil 1": "s. d." if f["q1"] != f["q1"] else num(f["q1"], _INDICADORES[f["indicator"]][1]),
        "Quintil 5": "s. d." if f["q5"] != f["q5"] else num(f["q5"], _INDICADORES[f["indicator"]][1]),
        "Razón Q5/Q1": "s. d." if f["q5OverQ1"] is None else num(f["q5OverQ1"], 2),
    } for f in filas])
    avisos = ["Con una selección de distritos algunos quintiles pueden quedar sin datos (s. d.)."] if sel is not None else []
    return Tabla("ts2", "Tabla S2", "Índices de concentración de indicadores de acceso, presión y oferta según pobreza distrital, "
                 "Trujillo metropolitano, Perú, diciembre de 2025.", mostrar, exportar, nota=nota, filtrable=True, avisos=avisos)


# ------------------------------------------------------------------ Tabla S3

_INTERVENCION = {"new_facility": "Nueva IPRESS", "expand_capacity": "Ampliación", "improve_access": "Mejora de acceso"}
_REGLA = {"Máxima demanda": "Máxima demanda o población", "Aleatoria (esperanza exacta)": "Aleatoria (esperanza)"}
# Filas que se muestran en el artículo: (intervención, con vecinos, reglas)
_FILAS_S3 = [
    ("new_facility", True, ["Máxima prioridad", "Máxima presión", "Máxima demanda", "Óptimo ex post", "Aleatoria (esperanza exacta)"]),
    ("new_facility", False, ["Óptimo ex post"]),
    ("expand_capacity", True, ["Máxima prioridad", "Máxima presión", "Máxima demanda", "Aleatoria (esperanza exacta)"]),
    ("improve_access", True, ["Máxima prioridad", "Máxima presión", "Máxima demanda", "Aleatoria (esperanza exacta)"]),
]


def tabla_s3() -> Tabla:
    ruta = RESULTADOS / datos.snapshot()["version"] / "rq2-targeting.csv"
    with ruta.open(encoding="utf-8") as fh:
        brutas = list(csv.DictReader(fh))
    filas = []
    for tipo, vecinos, reglas in _FILAS_S3:
        for regla in reglas:
            r = next(x for x in brutas if x["intervention"] == tipo and (x["propagation"].lower() == "true") == vecinos and x["rule"] == regla)
            filas.append({
                "Intervención": _INTERVENCION[tipo], "Vecinos": "Sí" if vecinos else "No", "Regla": _REGLA.get(regla, regla),
                "Distrito elegido": "Todos" if r["district"] == "todos" else r["district"],
                "Δ prioridad media": float(r["deltaPriority"]), "Δ IC déficit acceso": float(r["deltaAccessConcentration"]),
                "Δ IC presión": float(r["deltaPressureConcentration"]),
            })
    exportar = pd.DataFrame(filas).round(6)
    mostrar = exportar.copy()
    for col in ("Δ prioridad media", "Δ IC déficit acceso", "Δ IC presión"):
        mostrar[col] = exportar[col].map(lambda x: num(x, 4, signo=True))
    nota = ("Vecinos: con o sin propagación del efecto a los distritos colindantes. Δ prioridad media: cambio en la prioridad "
            "media ponderada por población. Δ IC: cambio en el índice de concentración según pobreza (un valor positivo indica "
            "mayor concentración en la población más pobre). En ampliación y mejora de acceso el óptimo ex post coincidió con "
            "Trujillo. La población en categorías alta o crítica no cambió con ninguna regla.")
    return Tabla("ts3", "Tabla S3", "Efecto simulado de las reglas de focalización sobre la prioridad media y los índices de "
                 "concentración, Trujillo metropolitano, Perú, escenario base de diciembre de 2025.", mostrar, exportar, nota=nota)


# ------------------------------------------------------------------ Tabla S4

def tabla_s4() -> Tabla:
    ruta = RESULTADOS / datos.snapshot()["version"] / "results.json"
    with ruta.open(encoding="utf-8") as fh:
        ts = {int(f["alpha"]): f for f in json.load(fh)["sensitivity"]}
    replica = datos.sensibilidad(None)
    exportar = pd.DataFrame([{
        "α": a, "Sorteos": ts[a]["draws"], "Tau de Kendall media": round(ts[a]["meanKendallTau"], 4),
        "Primer lugar estable (%)": round(ts[a]["topDistrictStableShare"] * 100, 2),
        "Cambios de categoría (%)": round(ts[a]["categoryChangeShare"] * 100, 3),
        "Réplica: tau media": round(replica[a]["tau_media"], 4),
        "Réplica: primer lugar (%)": round(replica[a]["primero_estable"] * 100, 2),
    } for a in datos.ALFAS])
    mostrar = pd.DataFrame({
        "α": exportar["α"].astype(str), "Sorteos": exportar["Sorteos"].map(miles),
        "Tau de Kendall media": exportar["Tau de Kendall media"].map(lambda x: num(x, 3)),
        "Primer lugar estable (%)": exportar["Primer lugar estable (%)"].map(lambda x: num(x, 1)),
        "Cambios de categoría (%)": exportar["Cambios de categoría (%)"].map(lambda x: num(x, 2)),
        "Réplica: tau media": exportar["Réplica: tau media"].map(lambda x: num(x, 3)),
        "Réplica: primer lugar (%)": exportar["Réplica: primer lugar (%)"].map(lambda x: num(x, 1)),
    })
    nota = ("α: parámetro de concentración de la distribución de Dirichlet. Pesos centrados en (0,35; 0,25; 0,25; 0,15). "
            "Réplica: implementación independiente en Python con otro generador de números aleatorios.")
    return Tabla("ts4", "Tabla S4", "Sensibilidad del ordenamiento de prioridad a la perturbación de pesos mediante distribución "
                 "de Dirichlet, Trujillo metropolitano, Perú, diciembre de 2025.", mostrar, exportar, nota=nota)


def todas(distritos=None) -> list[Tabla]:
    return [tabla_2(distritos), tabla_3(distritos), tabla_s2(distritos), tabla_s3(), tabla_s4()]

"""Comprobaciones: cada cifra que el Word atribuye a una figura se recalcula desde los datos y se compara."""

from __future__ import annotations

import csv
from pathlib import Path
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

import numpy as np
import pandas as pd

from . import datos, modelo

RESULTADOS = Path(datos.SNAPSHOT_PATH).parents[1] / "research" / "results"

# Valores tal como aparecen en el artículo (Tabla 2: prioridad y tiempo; Tabla 3; Tablas S2 y S4; texto).
TABLA2 = {
    "Salaverry": (0.32, 41.0, 1003), "Poroto": (0.31, 16.0, 546), "Laredo": (0.29, 35.9, 1703),
    "Huanchaco": (0.23, 12.4, 2707), "El Porvenir": (0.22, 11.9, 4931), "La Esperanza": (0.19, 8.4, 6646),
    "Moche": (0.18, 11.7, 3454), "Florencia de Mora": (0.15, 6.0, 2270), "Trujillo": (0.13, 7.9, 25006),
    "Víctor Larco Herrera": (0.11, 6.7, 3243),
}
TABLA3_MAE = {
    "Potenciación de gradiente": 540.1, "Persistencia del último mes": 525.8, "Bosque aleatorio": 580.4,
    "Regresión Ridge": 576.8, "Persistencia estacional": 657.5,
}
TABLA2_COMPLETA = {  # distrito: población, pobreza %, IPRESS, consultas, capacidad, presión, tiempo, acceso, prioridad
    "Salaverry": (25844, 18.7, 4, 1003, 1231, 0.81, 41.0, 0.26, 0.32),
    "Poroto": (4032, 32.1, 1, 546, 611, 0.89, 16.0, 0.59, 0.31),
    "Laredo": (56718, 17.1, 6, 1703, 2273, 0.75, 35.9, 0.30, 0.29),
    "Huanchaco": (103075, 18.9, 15, 2707, 3263, 0.83, 12.4, 0.66, 0.23),
    "El Porvenir": (134258, 24.2, 19, 4931, 6778, 0.73, 11.9, 0.67, 0.22),
    "La Esperanza": (249310, 19.2, 28, 6646, 8366, 0.79, 8.4, 0.76, 0.19),
    "Moche": (47246, 13.3, 10, 3454, 4575, 0.75, 11.7, 0.68, 0.18),
    "Florencia de Mora": (65310, 20.9, 9, 2270, 3391, 0.67, 6.0, 0.82, 0.15),
    "Trujillo": (359982, 5.0, 275, 25006, 33716, 0.74, 7.9, 0.77, 0.13),
    "Víctor Larco Herrera": (85912, 6.1, 44, 3243, 4702, 0.69, 6.7, 0.80, 0.11),
}
TABLA2_TOTAL = (1131687, 14.1, 411, 51509, 68906, 0.75)
TABLA3_COMPLETA = {  # modelo: MAE, DE, RMSE, DE, MAPE, DE, R², DE, rango medio
    "Potenciación de gradiente": (540.1, 150.7, 971.4, 388.9, 10.2, 1.9, 0.984, 0.009, 2.2),
    "Persistencia del último mes": (525.8, 201.1, 1091.3, 507.0, 9.9, 3.3, 0.978, 0.019, 2.6),
    "Bosque aleatorio": (580.4, 226.2, 1128.9, 622.1, 9.6, 1.1, 0.976, 0.021, 2.6),
    "Regresión Ridge": (576.8, 137.6, 1001.9, 263.5, 14.6, 3.2, 0.983, 0.007, 3.2),
    "Persistencia estacional": (657.5, 141.8, 1265.6, 401.1, 10.4, 1.9, 0.973, 0.012, 4.4),
}
TABLA_S4_TS = {20: (0.928, 67.1, 1.41), 50: (0.953, 78.3, 0.29), 100: (0.966, 88.0, 0.02)}  # tau, primer lugar %, cambios categoría %
IMPORTANCIAS = {
    "Rezago 1 mes": 0.491, "Rezago 12 meses": 0.229, "Rezago 6 meses": 0.081, "log(población)": 0.074,
    "IPRESS operativas": 0.046, "Pobreza": 0.041, "Rezago 3 meses": 0.019, "Población": 0.015,
    "Densidad": 0.002, "Mes (seno)": 0.001, "Mes (coseno)": 0.000,
}
TABLA_S2 = {  # indicador: (índice, IC bajo, IC alto, quintil 1, quintil 5)
    "accessDeficit": (0.030, -0.163, 0.140, 0.226, 0.331),
    "travelMinutes": (0.031, -0.247, 0.207, 7.7, 12.0),
    "pressure": (0.004, -0.020, 0.024, 0.732, 0.732),
    "facilitiesPer10k": (0.039, -0.158, 0.144, 0.52, 0.80),
}
TABLA_S4 = {20: (0.929, 67.7), 50: (0.953, 78.1), 100: (0.966, 87.4)}  # tau media y primer lugar de la réplica (%)
RANGOS_F4 = {  # intervención: (mínimo, máximo) del cambio de prioridad
    "new_facility": (-0.14, -0.05), "expand_capacity": (-0.08, -0.03), "improve_access": (-0.05, -0.03),
    "temporary_closure": (0.17, 0.20),
}
CIERRE_CATEGORIA_MEDIA = {"Huanchaco": 0.41, "Laredo": 0.46, "Salaverry": 0.49, "Poroto": 0.51}


def _mitad_arriba(valor: float, dec: int) -> float:
    return float(Decimal(repr(float(valor))).quantize(Decimal(1).scaleb(-dec), rounding=ROUND_HALF_UP))


def _fila(figura: str, elemento: str, word: float, calculado: float, dec: int) -> dict[str, Any]:
    """Estados: Coincide (mismo valor al redondear), Redondeo (solo si se redondea dos veces) o Difiere."""
    exacto = abs(_mitad_arriba(calculado, dec) - word) <= 10 ** -dec * 0.51 or abs(calculado - word) <= 0.5 * 10 ** -dec + 1e-9
    doble = (not exacto) and abs(_mitad_arriba(_mitad_arriba(calculado, dec + 1), dec) - word) <= 10 ** -dec * 0.51
    estado = "Coincide" if exacto else ("Redondeo" if doble else "Difiere")
    observacion = ""
    if estado == "Redondeo":
        observacion = f"Valor exacto {calculado:.{dec + 3}f}: el Word parece haber redondeado dos veces."
    elif estado == "Difiere":
        observacion = "Revisar contra el cálculo."
    return {"Figura": figura, "Elemento": elemento, "Valor en el Word": word,
            "Valor recalculado": round(calculado, dec + 1), "Estado": estado, "Coincide": estado == "Coincide",
            "Observación": observacion}


def _pares_retrospectivos(v: modelo.Vista) -> tuple[list[float], list[float], list[float]]:
    actual, estacional, ultimo = [], [], []
    for t in v.territorios:
        for mes in sorted(m for m in t.history if m <= v.month):
            est, ult = t.history.get(modelo.next_month(mes, -12)), t.history.get(modelo.next_month(mes, -1))
            if est is not None and ult is not None:
                actual.append(t.history[mes]); estacional.append(est); ultimo.append(ult)
    return actual, estacional, ultimo


def comprobaciones() -> pd.DataFrame:
    v = datos.vista()
    filas: list[dict[str, Any]] = []

    # Figura 2 (Tabla 2)
    for nombre, (prio, minutos, consultas) in TABLA2.items():
        t = v.por_nombre(nombre)
        filas.append(_fila("Figura 2", f"{nombre}: índice de prioridad", prio, t.priority, 2))
        filas.append(_fila("Figura 2", f"{nombre}: tiempo de viaje (min)", minutos, t.travel_minutes, 1))
    filas.append(_fila("Figura 2", "IPRESS públicas de primer nivel con coordenadas", 64, len(v.ipress_primer_nivel), 0))
    filas.append(_fila("Figura 2", "Registros RENIPRESS en el área", 613, v.n_ipress_registradas, 0))
    filas.append(_fila("Figura 2", "IPRESS operativas", 411, v.n_ipress_operativas, 0))

    # Figura 3
    total = sum(sum(t.history.values()) for t in v.territorios)
    filas.append(_fila("Figura 3", "Consultas SIS 2024 a 2025 (total)", 1327240, total, 0))
    filas.append(_fila("Figura 3", "Consultas SIS de diciembre de 2025", 51509, sum(t.demand for t in v.territorios), 0))
    series = {t.name: modelo.serie_pronostico(t) for t in v.territorios}
    filas.append(_fila("Figura 3", "Pronóstico enero a junio de 2026 (total)", 337203, sum(sum(s["fc"]) for s in series.values()), 0))
    filas.append(_fila("Figura 3", "Trujillo: banda del 90 % (± consultas por mes)", 5348, round(series["Trujillo"]["banda90"]), 0))
    for nombre, (_, _, consultas) in TABLA2.items():
        filas.append(_fila("Figura 3", f"{nombre}: último valor observado", consultas, series[nombre]["obs"][-1], 0))
    actual, est, ult = (np.array(x, dtype=float) for x in _pares_retrospectivos(v))
    filas.append(_fila("Figura 3", "Persistencia estacional: MAE retrospectivo", 607.0, np.abs(actual - est).mean(), 1))
    filas.append(_fila("Figura 3", "Persistencia estacional: MAPE retrospectivo (%)", 14.1, (np.abs(actual - est) / actual).mean() * 100, 1))
    filas.append(_fila("Figura 3", "Persistencia del último mes: MAE retrospectivo", 499.0, np.abs(actual - ult).mean(), 1))
    filas.append(_fila("Figura 3", "Persistencia del último mes: MAPE retrospectivo (%)", 9.6, (np.abs(actual - ult) / actual).mean() * 100, 1))
    filas.append(_fila("Figura 3", "Predicciones retrospectivas evaluadas", 120, len(actual), 0))

    # Figura 4
    matriz = modelo.matriz_intervenciones(v)
    nombres = {"new_facility": "nueva IPRESS", "expand_capacity": "ampliación", "improve_access": "mejora de acceso", "temporary_closure": "cierre temporal"}
    for tipo, (lo, hi) in RANGOS_F4.items():
        valores = [f[tipo] for f in matriz]
        filas.append(_fila("Figura 4", f"{nombres[tipo]}: cambio mínimo", lo, min(valores), 2))
        filas.append(_fila("Figura 4", f"{nombres[tipo]}: cambio máximo", hi, max(valores), 2))
    for fila in matriz:
        if fila["distrito"] in CIERRE_CATEGORIA_MEDIA:
            filas.append(_fila("Figura 4", f"{fila['distrito']}: prioridad tras el cierre", CIERRE_CATEGORIA_MEDIA[fila["distrito"]],
                               fila["prioridad_basal"] + fila["temporary_closure"], 2))
    ruta = next(RESULTADOS.glob("*/rq1-scenarios.csv"), None)
    if ruta:
        with ruta.open(encoding="utf-8") as fh:
            esc = list(csv.DictReader(fh))
        coinciden = sum(1 for r in esc if abs(modelo.simular(v.por_nombre(r["district"]), v, r["intervention"])["delta"] - float(r["delta"])) < 1e-9)
        filas.append(_fila("Figura 4", f"Escenarios idénticos a research/results ({len(esc)})", len(esc), coinciden, 0))

    # Figura S1 (Tabla 3 y texto)
    r = datos.validacion_temporal()
    resumen = r["resumen"].set_index("Modelo")
    for modelo_, mae in TABLA3_MAE.items():
        filas.append(_fila("Figura S1", f"{modelo_}: MAE medio", mae, resumen.loc[modelo_, "MAE"], 1))
    for variable, valor in IMPORTANCIAS.items():
        filas.append(_fila("Figura S1", f"Importancia: {variable}", valor, r["importancias"][variable], 3))
    filas.append(_fila("Figura S1", "Prueba de Friedman: chi cuadrado", 5.92, r["friedman"][0], 2))
    filas.append(_fila("Figura S1", "Prueba de Friedman: p", 0.205, r["friedman"][1], 3))
    filas.append(_fila("Figura S1", "Wilcoxon (potenciación vs. estacional): W", 0.0, r["wilcoxon"][0], 0))
    filas.append(_fila("Figura S1", "Wilcoxon (potenciación vs. estacional): p", 0.063, r["wilcoxon"][1], 3))

    # Figura S2 (Tabla S2 y texto)
    conc = {c["indicator"]: c for c in modelo.tabla_concentracion(v)}
    for indicador, (ic, lo, hi, q1, q5) in TABLA_S2.items():
        c = conc[indicador]
        filas.append(_fila("Figura S2", f"{indicador}: índice de concentración", ic, c["concentration"], 3))
        filas.append(_fila("Figura S2", f"{indicador}: IC 95 % inferior", lo, c["ciLow"], 3))
        filas.append(_fila("Figura S2", f"{indicador}: IC 95 % superior", hi, c["ciHigh"], 3))
    quintiles = modelo.valores_por_quintil(v)
    filas.append(_fila("Figura S2", "Tiempo de viaje Q1 (min)", 7.7, quintiles[0]["tiempo_viaje_min"], 1))
    filas.append(_fila("Figura S2", "Tiempo de viaje Q2 (min)", 24.9, quintiles[1]["tiempo_viaje_min"], 1))
    filas.append(_fila("Figura S2", "Tiempo de viaje Q3 (min)", 18.2, quintiles[2]["tiempo_viaje_min"], 1))
    filas.append(_fila("Figura S2", "Tiempo de viaje Q5 (min)", 12.0, quintiles[4]["tiempo_viaje_min"], 1))
    filas.append(_fila("Figura S2", "IPRESS por 10.000 hab. Q1", 0.52, quintiles[0]["ipress_por_100k"] / 10, 2))
    filas.append(_fila("Figura S2", "IPRESS por 10.000 hab. Q5", 0.80, quintiles[4]["ipress_por_100k"] / 10, 2))

    # Figura S3 (Tabla S4, réplica en Python)
    sens = datos.sensibilidad()
    for alfa, (tau, primero) in TABLA_S4.items():
        filas.append(_fila("Figura S3", f"α = {alfa}: tau de Kendall media", tau, sens[alfa]["tau_media"], 3))
        filas.append(_fila("Figura S3", f"α = {alfa}: primer lugar estable (%)", primero, sens[alfa]["primero_estable"] * 100, 1))

    # Tabla 2 completa (cada columna)
    campos = ["Población 2025", "Pobreza (%)", "IPRESS", "Consultas SIS", "Capacidad de referencia", "Presión", "Tiempo (min)", "Acceso (A)", "Prioridad"]
    decimales = [0, 1, 0, 0, 0, 2, 1, 2, 2]
    tabla2 = tablas_mod().tabla_2().exportar.set_index("Distrito")
    for nombre, valores in TABLA2_COMPLETA.items():
        for campo, dec, esperado in zip(campos, decimales, valores):
            filas.append(_fila("Tabla 2", f"{nombre}: {campo}", esperado, float(tabla2.loc[nombre, campo]), dec))
    pobreza_total = sum(t.poverty * t.population for t in v.territorios) / sum(t.population for t in v.territorios) * 100
    for campo, dec, esperado in zip(campos[:6], decimales[:6], TABLA2_TOTAL):
        calculado = pobreza_total if campo == "Pobreza (%)" else float(tabla2.loc["Total", campo])
        filas.append(_fila("Tabla 2", f"Total: {campo}", esperado, calculado, dec))

    # Tabla 3 completa
    res = datos.validacion_temporal().get("resumen").set_index("Modelo")
    columnas = [("MAE", 1), ("MAE DE", 1), ("RMSE", 1), ("RMSE DE", 1), ("MAPE", 1), ("MAPE DE", 1), ("R2", 3), ("R2 DE", 3), ("Rango medio", 1)]
    for nombre, valores in TABLA3_COMPLETA.items():
        for (col, dec), esperado in zip(columnas, valores):
            filas.append(_fila("Tabla 3", f"{nombre}: {col}", esperado, float(res.loc[nombre, col]), dec))

    # Tabla S4 (ordenamiento con el generador de TypeScript)
    ruta_resultados = next(RESULTADOS.glob("*/results.json"), None)
    if ruta_resultados:
        import json
        with ruta_resultados.open(encoding="utf-8") as fh:
            ts = {int(f["alpha"]): f for f in json.load(fh)["sensitivity"]}
        for alfa, (tau, primero, cambios) in TABLA_S4_TS.items():
            filas.append(_fila("Tabla S4", f"α = {alfa}: tau media", tau, ts[alfa]["meanKendallTau"], 3))
            filas.append(_fila("Tabla S4", f"α = {alfa}: primer lugar estable (%)", primero, ts[alfa]["topDistrictStableShare"] * 100, 1))
            filas.append(_fila("Tabla S4", f"α = {alfa}: cambios de categoría (%)", cambios, ts[alfa]["categoryChangeShare"] * 100, 2))

    return pd.DataFrame(filas)


def tablas_mod():
    from . import tablas  # importación diferida para evitar ciclos
    return tablas

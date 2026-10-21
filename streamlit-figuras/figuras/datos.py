"""Cálculos que alimentan las figuras. Todo sale de data/official-snapshot.json.

Las funciones con parámetro `distritos` aceptan una tupla de nombres; `None` significa todos los distritos,
que es la vista idéntica a la del artículo.
"""

from __future__ import annotations

import json
import warnings
from functools import lru_cache
from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import friedmanchisquare, wilcoxon
from sklearn.base import clone
from sklearn.model_selection import TimeSeriesSplit

from src.config import SNAPSHOT_PATH
from src.data_loader import build_modeling_table, seasonal_naive_predict
from src.models import evaluate_predictions, get_model_catalog

from . import modelo

NOMBRES_MODELOS = {
    "Persistencia del último mes": "lag_1",
    "Potenciación de gradiente": "Gradient Boosting",
    "Regresión Ridge": "Ridge (L2)",
    "Bosque aleatorio": "Random Forest",
    "Persistencia estacional": "Seasonal Naïve (t-12)",
}
ETIQUETAS_VARIABLES = {
    "lag_1": "Rezago 1 mes", "lag_12": "Rezago 12 meses", "lag_6": "Rezago 6 meses",
    "log_population": "log(población)", "facilities_operational": "IPRESS operativas",
    "poverty_rate": "Pobreza", "lag_3": "Rezago 3 meses", "population": "Población",
    "density": "Densidad", "month_sin": "Mes (seno)", "month_cos": "Mes (coseno)",
}
SEMILLA_SENSIBILIDAD = 42
ALFAS = (20, 50, 100)


@lru_cache(maxsize=1)
def snapshot() -> dict[str, Any]:
    with SNAPSHOT_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


@lru_cache(maxsize=1)
def vista() -> modelo.Vista:
    return modelo.construir_vista(snapshot())


def nombres_distritos() -> list[str]:
    return sorted(t.name for t in vista().territorios)


def normalizar(distritos) -> tuple[str, ...] | None:
    """None si la selección es vacía o incluye los diez distritos; en otro caso una tupla ordenada y sin repetidos."""
    if not distritos:
        return None
    elegidos = tuple(sorted(set(distritos)))
    return None if set(elegidos) == set(nombres_distritos()) else elegidos


# ------------------------------------------------------------------ aprendizaje automático

@lru_cache(maxsize=1)
def _motor_validacion() -> dict[str, Any]:
    """Ajusta cada modelo en los cinco pliegues temporales una sola vez y guarda las predicciones por fila."""
    warnings.filterwarnings("ignore")
    raw, modeling, meta = build_modeling_table(snapshot())
    features = meta["feature_cols"]
    ordenado = modeling.sort_values("month").reset_index(drop=True)
    X, y = ordenado[features], ordenado["demand"].values
    cv = TimeSeriesSplit(n_splits=5)
    pliegues = list(cv.split(ordenado))
    catalogo = {m.name: m for m in get_model_catalog()}

    predicciones: dict[str, list[np.ndarray]] = {}
    for etiqueta, clave in NOMBRES_MODELOS.items():
        preds = []
        for tr, te in pliegues:
            if clave == "lag_1":
                preds.append(ordenado["lag_1"].values[te])
            elif clave == "Seasonal Naïve (t-12)":
                # Misma lógica que run_baseline: busca el mismo mes del año anterior en el historial de entrenamiento
                # y, si no está, usa el último mes disponible del distrito.
                historial = raw[raw["month"].isin(ordenado.iloc[tr]["month"])]
                preds.append(np.array([seasonal_naive_predict(fila, historial) for _, fila in ordenado.iloc[te].iterrows()]))
            else:
                modelo_ = clone(catalogo[clave].estimator).fit(X.iloc[tr], y[tr])
                preds.append(modelo_.predict(X.iloc[te]))
        predicciones[etiqueta] = preds

    # Modelo final: potenciación de gradiente con la tabla de modelado en su orden original.
    final = clone(catalogo["Gradient Boosting"].estimator).fit(modeling[features], modeling["demand"].values)
    importancias = (
        pd.Series(final.feature_importances_, index=features).rename(index=ETIQUETAS_VARIABLES)
        .sort_values(ascending=False)
    )
    return {
        "ordenado": ordenado, "y": y, "pliegues": pliegues, "predicciones": predicciones,
        "importancias": importancias, "n_filas_modelado": len(modeling),
    }


@lru_cache(maxsize=64)
def validacion_temporal(distritos: tuple[str, ...] | None = None) -> dict[str, Any]:
    """Validación cruzada temporal de cinco pliegues (Tabla 3, Figura S1).

    Los modelos se entrenan con todos los distritos; con una selección solo se evalúan las filas de esos distritos.
    """
    m = _motor_validacion()
    ordenado, y = m["ordenado"], m["y"]
    en_seleccion = np.ones(len(ordenado), dtype=bool) if not distritos else ordenado["district_name"].isin(distritos).values

    filas_pliegue: dict[str, list[dict[str, float]]] = {}
    for etiqueta, preds in m["predicciones"].items():
        filas = []
        for (_, te), pred in zip(m["pliegues"], preds):
            sel = en_seleccion[te]
            filas.append(evaluate_predictions(y[te][sel], pred[sel]))
        filas_pliegue[etiqueta] = filas

    resumen = []
    for etiqueta, filas in filas_pliegue.items():
        f = pd.DataFrame(filas)
        resumen.append({
            "Modelo": etiqueta,
            "MAE": f.mae.mean(), "MAE DE": f.mae.std(ddof=1),
            "RMSE": f.rmse.mean(), "RMSE DE": f.rmse.std(ddof=1),
            "MAPE": f.mape.mean(), "MAPE DE": f.mape.std(ddof=1),
            "R2": f.r2.mean(), "R2 DE": f.r2.std(ddof=1),
        })
    resumen = pd.DataFrame(resumen).sort_values("MAE").reset_index(drop=True)

    tabla_mae = pd.DataFrame({k: [r["mae"] for r in v] for k, v in filas_pliegue.items()})
    rangos = tabla_mae.rank(axis=1).mean()
    resumen["Rango medio"] = resumen["Modelo"].map(rangos)
    friedman = friedmanchisquare(*[tabla_mae[c] for c in tabla_mae.columns])
    w = wilcoxon(tabla_mae["Potenciación de gradiente"], tabla_mae["Persistencia estacional"])
    meses = ordenado["month"]
    return {
        "mae_pliegues": tabla_mae, "resumen": resumen, "importancias": m["importancias"],
        "friedman": (float(friedman.statistic), float(friedman.pvalue)),
        "wilcoxon": (float(w.statistic), float(w.pvalue)),
        "n_filas_modelado": m["n_filas_modelado"], "n_filas_prueba": int(sum(en_seleccion[te].sum() for _, te in m["pliegues"])),
        "meses_prueba": (meses.iloc[m["pliegues"][0][1][0]], meses.iloc[-1]),
    }


# ------------------------------------------------------------------ sensibilidad (Figura S3)

@lru_cache(maxsize=1)
def _sorteos() -> dict[str, Any]:
    """Réplica independiente en Python: Dirichlet con NumPy, 10.000 sorteos por concentración."""
    v = vista()
    T = [t for t in v.territorios if t.priority is not None]
    comps = np.array([[t.poverty, min(max(t.pressure - 0.6, 0), 1), 1 - t.access, 0.8 * t.neighbor_score] for t in T])
    rng = np.random.default_rng(SEMILLA_SENSIBILIDAD)
    pesos0 = np.array(modelo.PESOS_BASE)
    puntajes = {}
    for alfa in ALFAS:
        W = rng.dirichlet(pesos0 * alfa, 10000)
        puntajes[alfa] = np.round(np.clip(W @ comps.T, 0.05, 0.98), 2)
    return {"nombres": [t.name for t in T], "base": np.array([t.priority for t in T]), "puntajes": puntajes}


def _posiciones(S: np.ndarray) -> np.ndarray:
    orden = np.argsort(-S, axis=1, kind="stable")
    pos = np.empty_like(orden)
    pos[np.arange(S.shape[0])[:, None], orden] = np.arange(S.shape[1])
    return pos


@lru_cache(maxsize=64)
def sensibilidad(distritos: tuple[str, ...] | None = None) -> dict[int, dict[str, Any]]:
    """Concordancia del ranking y primer lugar ante pesos perturbados, opcionalmente entre los distritos elegidos."""
    s = _sorteos()
    cols = [i for i, n in enumerate(s["nombres"]) if not distritos or n in distritos]
    nombres = [s["nombres"][i] for i in cols]
    base = s["base"][cols]
    top_base = int(np.argmax(base))
    iu = np.triu_indices(len(cols), 1)
    pos_base = _posiciones(base[None, :])[0]
    sb = np.sign(pos_base[iu[0]] - pos_base[iu[1]])
    salida = {}
    for alfa in ALFAS:
        S = s["puntajes"][alfa][:, cols]
        pos = _posiciones(S)
        tau = (sb * np.sign(pos[:, iu[0]] - pos[:, iu[1]])).sum(1) / len(iu[0])
        primero = np.argmax(S, axis=1)
        salida[alfa] = {
            "tau": tau, "tau_media": float(tau.mean()),
            "primer_lugar": {nombres[i]: float((primero == i).mean()) for i in np.unique(primero)},
            "primero_estable": float((primero == top_base).mean()),
            "distrito_base": nombres[top_base],
        }
    return salida

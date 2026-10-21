"""Port a Python del motor del gemelo digital (src/lib/officialModel.ts, simulationEngine.ts y scripts/evaluate.ts).

Reproduce solo lo necesario para regenerar las figuras del artículo a partir de
data/official-snapshot.json: territorios, prioridad, simulación de intervenciones,
quintiles de pobreza, índice de concentración con bootstrap y pronóstico estacional.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Any, Callable

import numpy as np

MESES_PREVIOS = 12
INSTITUCION_ELEGIBLE = re.compile(
    r"GOBIERNO REGIONAL|GOBIERNO LOCAL|MINISTERIO DE SALUD|MINSA|ESSALUD|SEGURO SOCIAL|SANIDAD", re.I
)
CATEGORIA_ELEGIBLE = re.compile(r"^I-[1-4]$")
INTERVENCIONES = ("new_facility", "expand_capacity", "improve_access", "temporary_closure")
PESOS_BASE = (0.35, 0.25, 0.25, 0.15)


def js_round(x: float) -> float:
    """Math.round de JavaScript (la mitad se redondea hacia arriba)."""
    return math.floor(x + 0.5)


def next_month(month: str, offset: int = 1) -> str:
    year, num = map(int, month.split("-"))
    total = year * 12 + (num - 1) + offset
    return f"{total // 12}-{total % 12 + 1:02d}"


def percentile(values: list[float], fraction: float) -> float | None:
    if not len(values):
        return None
    return float(np.percentile(np.asarray(values, dtype=float), fraction * 100))


def seasonal_forecast(history: dict[str, float], month: str) -> float | None:
    previous_year = f"{int(month[:4]) - 1}{month[4:]}"
    if previous_year in history:
        return history[previous_year]
    available = sorted(k for k in history if k < month)
    return history[available[-1]] if available else None


def haversine(a: dict[str, float], b: dict[str, float]) -> float:
    rad = math.radians
    dlat, dlng = rad(b["lat"] - a["lat"]), rad(b["lng"] - a["lng"])
    h = math.sin(dlat / 2) ** 2 + math.cos(rad(a["lat"])) * math.cos(rad(b["lat"])) * math.sin(dlng / 2) ** 2
    return 6371 * 2 * math.asin(min(1.0, math.sqrt(h)))


def hotspot_category(score: float) -> str:
    if score >= 0.8:
        return "Crítico"
    if score >= 0.6:
        return "Alto"
    if score >= 0.4:
        return "Medio"
    return "Bajo"


def priority_index(vulnerability: float, pressure: float, access: float, spillover: float) -> float:
    pressure_score = min(max(pressure - 0.6, 0.0), 1.0)
    deficit = max(1 - access, 0.0)
    raw = vulnerability * 0.35 + pressure_score * 0.25 + deficit * 0.25 + spillover * 0.15
    return js_round(min(max(raw, 0.05), 0.98) * 100) / 100


@dataclass
class Territorio:
    id: int
    code: str
    name: str
    population: int
    poverty: float
    coordinates: dict[str, float]
    geometry: dict[str, Any]
    neighbor_ids: list[int]
    history: dict[str, float]
    quintile: int = 1
    distance_km: float | None = None
    travel_minutes: float | None = None
    access: float | None = None
    capacity: float | None = None
    demand: float | None = None
    pressure: float | None = None
    neighbor_score: float = 0.0
    priority: float | None = None
    n_ipress_activas: int = 0
    n_operativas: int = 0

    @property
    def category(self) -> str:
        return "Sin dato" if self.priority is None else hotspot_category(self.priority)


@dataclass
class Vista:
    month: str
    territorios: list[Territorio]
    ipress_primer_nivel: list[dict[str, Any]] = field(default_factory=list)
    n_ipress_registradas: int = 0
    n_ipress_operativas: int = 0

    def por_nombre(self, nombre: str) -> Territorio:
        return next(t for t in self.territorios if t.name == nombre)


def construir_vista(snapshot: dict[str, Any], month: str | None = None) -> Vista:
    """Equivalente a buildModelView(snapshot, month) para el mes de referencia."""
    month = month or snapshot["months"][-1]
    year = int(month[:4])
    previos = [next_month(month, i - 11) for i in range(MESES_PREVIOS)]

    hist_fac: dict[str, dict[str, float]] = {}
    for district in snapshot["districts"]:
        hist_fac.update(district["facilityHistory"])

    operativas = [f for f in snapshot["facilities"] if f["operationalStatus"] == "Operativo"]
    direct: dict[str, int] = {}
    for fac in operativas:
        h = hist_fac.get(fac["code"], {})
        observed = [h[k] for k in previos if k in h]
        if len(observed) >= 6:
            direct[fac["code"]] = math.ceil(percentile(observed, 0.95))

    cat_median: dict[str, int] = {}
    for cat in {f["category"] for f in snapshot["facilities"]}:
        caps = [direct[f["code"]] for f in snapshot["facilities"] if f["category"] == cat and f["code"] in direct]
        value = percentile(caps, 0.5)
        if value is not None:
            cat_median[cat] = math.ceil(value)

    facilities = []
    for fac in snapshot["facilities"]:
        h = hist_fac.get(fac["code"])
        cap = None
        if fac["operationalStatus"] == "Operativo":
            cap = direct.get(fac["code"], cat_median.get(fac["category"]))
        facilities.append({**fac, "monthlyCapacity": cap, "activitySis": bool(h)})

    elegibles = [
        f for f in facilities
        if f["operationalStatus"] == "Operativo"
        and INSTITUCION_ELEGIBLE.search(f.get("institution") or "")
        and CATEGORIA_ELEGIBLE.match(f["category"])
        and f["latitude"] is not None and f["longitude"] is not None
    ]

    territorios: list[Territorio] = []
    for d in snapshot["districts"]:
        pop = d["populationByYear"].get(str(year))
        pov = (d["povertyInterval"][0] + d["povertyInterval"][1]) / 200
        dist = min(
            (haversine(d["coordinates"], {"lat": f["latitude"], "lng": f["longitude"]}) for f in elegibles),
            default=None,
        )
        minutes = None if dist is None else 5 + dist * 1.3 * 3
        access = None if minutes is None else math.exp(-minutes / 30)
        mine = [f for f in facilities if f["districtId"] == d["id"] and f["operationalStatus"] == "Operativo" and f["activitySis"]]
        caps = [f["monthlyCapacity"] for f in mine if f["monthlyCapacity"] is not None]
        capacity = sum(caps) if caps else None
        demand = d["history"].get(month)
        pressure = demand / capacity if capacity and demand is not None else None
        territorios.append(Territorio(
            id=d["id"], code=d["code"], name=d["name"], population=pop, poverty=pov,
            coordinates=d["coordinates"], geometry=d["geometry"], neighbor_ids=d["neighborIds"],
            history=d["history"], distance_km=dist, travel_minutes=minutes, access=access,
            capacity=capacity, demand=demand, pressure=pressure, n_ipress_activas=len(mine),
            n_operativas=sum(1 for f in facilities if f["districtId"] == d["id"] and f["operationalStatus"] == "Operativo"),
        ))

    by_id = {t.id: t for t in territorios}
    for t in territorios:
        vecinos = [by_id[i] for i in t.neighbor_ids if i in by_id and by_id[i].pressure is not None]
        t.neighbor_score = (
            sum(min(max(v.pressure - 0.6, 0.0), 1.0) for v in vecinos) / len(vecinos) if vecinos else 0.0
        )
        if t.pressure is not None and t.access is not None:
            t.priority = priority_index(t.poverty, t.pressure, t.access, 0.8 * t.neighbor_score)

    for i, t in enumerate(sorted(territorios, key=lambda x: x.poverty)):  # orden estable, igual que JS
        t.quintile = i // 2 + 1

    return Vista(
        month=month,
        territorios=territorios,
        ipress_primer_nivel=elegibles,
        n_ipress_registradas=len(snapshot["facilities"]),
        n_ipress_operativas=len(operativas),
    )


# --------------------------------------------------------------------------- simulación

def simular(target: Territorio, vista: Vista, tipo: str) -> dict[str, float]:
    """Equivalente a DigitalTwinEngine.runSimulation sin establecimiento concreto."""
    access, capacity, minutes = target.access, target.capacity, target.travel_minutes
    if tipo == "new_facility":
        capacity += 2200
        access = min(access + 0.24, 0.96)
        minutes = max(minutes * 0.70, 8.5)
    elif tipo == "expand_capacity":
        capacity += js_round(capacity * 0.35)
        access = min(access + 0.08, 0.95)
        minutes = max(minutes * 0.88, 9.0)
    elif tipo == "improve_access":
        red = 0.25
        minutes = max(minutes * (1 - red), 7.0)
        access = min(access + red * 0.7, 0.95)
    elif tipo == "temporary_closure":
        reduction = js_round(capacity * 0.40)
        share = reduction / capacity if capacity > 0 else 0.4
        capacity = max(capacity - reduction, 1)
        access = max(access - 0.20 * (share / 0.4), 0.15)
        minutes = minutes * (1 + 0.35 * (share / 0.4))
    else:
        raise ValueError(tipo)

    pressure = js_round(target.demand / capacity * 100) / 100
    priority = priority_index(target.poverty, pressure, access, target.neighbor_score * 0.8)
    return {
        "priority_before": target.priority,
        "priority_after": priority,
        "delta": js_round((priority - target.priority) * 100) / 100,
        "access_after": access,
        "pressure_after": pressure,
        "minutes_after": js_round(minutes * 10) / 10,
    }


def seleccionar(vista: Vista, distritos: tuple[str, ...] | None) -> list[Territorio]:
    """Territorios elegidos por el usuario; None equivale a todos (vista del artículo)."""
    if not distritos:
        return list(vista.territorios)
    return [t for t in vista.territorios if t.name in distritos]


def matriz_intervenciones(vista: Vista, distritos: tuple[str, ...] | None = None) -> list[dict[str, Any]]:
    """Una fila por distrito con el cambio de prioridad para cada intervención (Figura 4)."""
    filas = []
    for t in seleccionar(vista, distritos):
        if t.priority is None:
            continue
        fila = {"distrito": t.name, "prioridad_basal": t.priority}
        for tipo in INTERVENCIONES:
            fila[tipo] = simular(t, vista, tipo)["delta"]
        filas.append(fila)
    return sorted(filas, key=lambda r: -r["prioridad_basal"])


# --------------------------------------------------------------------------- equidad

def media_ponderada(rows: list[Territorio], fn: Callable[[Territorio], float]) -> float:
    total = sum(r.population for r in rows)
    return sum(r.population * fn(r) for r in rows) / total


def concentracion(rows: list[Territorio], fn: Callable[[Territorio], float]) -> float | None:
    ordered = sorted(rows, key=lambda r: r.poverty)
    total = sum(r.population for r in ordered)
    avg = media_ponderada(ordered, fn)
    if avg == 0:
        return None
    cumulative = weighted = 0.0
    for r in ordered:
        share = r.population / total
        rank = cumulative + share / 2
        weighted += share * fn(r) * rank
        cumulative += share
    return 2 * weighted / avg - 1


class LCG:
    """Mismo generador congruencial del script de evaluación en TypeScript."""

    def __init__(self, seed: int):
        self.state = seed & 0xFFFFFFFF

    def __call__(self) -> float:
        self.state = (self.state * 1664525 + 1013904223) & 0xFFFFFFFF
        return self.state / 4294967296


def indicadores(vista: Vista) -> dict[str, Callable[[Territorio], float]]:
    return {
        "accessDeficit": lambda t: 1 - (t.access or 0),
        "travelMinutes": lambda t: t.travel_minutes or 0,
        "pressure": lambda t: t.pressure or 0,
        "facilitiesPer10k": lambda t: t.n_ipress_activas * 10000 / t.population,
    }


def _quantile_floor(values: list[float], p: float) -> float:
    s = sorted(values)
    return s[math.floor((len(s) - 1) * p)]


def tabla_concentracion(vista: Vista, replicas: int = 5000, seed: int = 1,
                        distritos: tuple[str, ...] | None = None) -> list[dict[str, Any]]:
    """Índices de concentración con IC bootstrap (Tabla S2 y Figura S2B).

    Con una selección de distritos el índice se calcula solo sobre ellos (se requieren al menos tres).
    """
    valid = [t for t in seleccionar(vista, distritos) if t.priority is not None]
    if len(valid) < 3:
        return []
    rng = LCG(seed)
    rows = []
    for key, fn in indicadores(vista).items():
        reps = []
        for _ in range(replicas):
            drawn = [valid[math.floor(rng() * len(valid))] for _ in valid]
            value = concentracion(drawn, fn)
            if value is not None:
                reps.append(value)
        q1 = [t for t in valid if t.quintile == 1]
        q5 = [t for t in valid if t.quintile == 5]
        a = media_ponderada(q1, fn) if q1 else float("nan")
        b = media_ponderada(q5, fn) if q5 else float("nan")
        rows.append({
            "indicator": key, "concentration": concentracion(valid, fn),
            "ciLow": _quantile_floor(reps, 0.025), "ciHigh": _quantile_floor(reps, 0.975),
            "q1": a, "q5": b, "q5OverQ1": b / a if a and a == a and b == b else None,
        })
    return rows


def valores_por_quintil(vista: Vista, distritos: tuple[str, ...] | None = None) -> list[dict[str, float]]:
    """Tiempo de viaje e IPRESS con actividad SIS por 100.000 hab., ponderados por quintil (Figura S2A).

    El quintil de pobreza se define con los diez distritos; la selección solo limita quiénes aportan al promedio.
    """
    out = []
    elegidos = seleccionar(vista, distritos)
    for q in range(1, 6):
        ds = [t for t in elegidos if t.quintile == q]
        if not ds:
            out.append({"quintil": q, "poblacion": 0, "tiempo_viaje_min": float("nan"), "ipress_por_100k": float("nan")})
            continue
        pop = sum(t.population for t in ds)
        minutos = media_ponderada(ds, lambda t: t.travel_minutes)
        ipress = sum(t.n_ipress_activas for t in ds) * 100000 / pop
        out.append({"quintil": q, "poblacion": pop, "tiempo_viaje_min": minutos, "ipress_por_100k": ipress})
    return out


# --------------------------------------------------------------------------- pronóstico

def serie_pronostico(t: Territorio, horizonte: int = 6) -> dict[str, Any]:
    """Serie observada, persistencia estacional y banda empírica del 90 % (Figura 3)."""
    meses = sorted(k for k in t.history)
    errores = []
    for i in range(12, len(meses)):
        pred = seasonal_forecast({m: t.history[m] for m in meses[:i]}, meses[i])
        if pred is not None:
            errores.append(abs(pred - t.history[meses[i]]))
    banda = percentile(errores, 0.9)
    futuros = [next_month(meses[-1], i + 1) for i in range(horizonte)]
    valores = [seasonal_forecast(t.history, m) for m in futuros]
    return {
        "meses_obs": meses, "obs": [t.history[m] for m in meses],
        "meses_fc": futuros, "fc": valores, "banda90": banda,
        "inf": [max(0, js_round(v - banda)) for v in valores],
        "sup": [js_round(v + banda) for v in valores],
    }

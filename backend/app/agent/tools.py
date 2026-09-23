"""Herramientas del agente sobre la API del gemelo digital.

Principio de diseño: el agente **nunca calcula**. El índice de prioridad, las
series espacio-temporales y las simulaciones salen del `DigitalTwinEngine` que
ya corre en Express (:3000). Estas funciones son la única vía por la que el
modelo obtiene cifras, y por eso son también el punto donde se controla qué
puede ver.

Dos decisiones que importan:

1. **Poda de campos.** Un `Territory` crudo trae `geoJsonCoords`, un polígono que
   el modelo no puede razonar y que multiplica el coste de cada turno. `_slim()`
   devuelve las 17 métricas que sí sirven, con nombres en español para que el
   modelo no tenga que traducir mentalmente.

2. **Traducción de convención.** El backend habla snake_case y la API camelCase.
   La conversión vive aquí, no en el prompt: pedirle al modelo que acierte el
   nombre exacto de un campo es una fuente de fallos evitable.
"""

from __future__ import annotations

import os
from typing import Any, Literal, Optional

import httpx
from dotenv import load_dotenv
from langchain_core.tools import tool
from pydantic import BaseModel, Field

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

TWIN_API_URL = os.getenv("TWIN_API_URL", "http://localhost:3000/api/v1")

# Cliente único: reutiliza la conexión TCP entre llamadas de un mismo turno.
_twin = httpx.Client(base_url=TWIN_API_URL, timeout=20.0)


class TwinUnavailable(RuntimeError):
    """El motor no responde. Se distingue de un error del modelo a propósito."""


def _get(path: str, **params: Any) -> Any:
    try:
        r = _twin.get(path, params={k: v for k, v in params.items() if v is not None})
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as exc:
        raise TwinUnavailable(f"El motor del gemelo no respondió a {path}: {exc}") from exc


def _slim(t: dict) -> dict:
    """Proyecta un territorio a lo que el modelo puede razonar. Sin geometría."""
    s, c = t["sdoh"], t["currentState"]
    return {
        "id": t["id"],
        "distrito": t["name"],
        "ubigeo": t["code"],
        "poblacion": t["population"],
        "densidad_hab_km2": t["density"],
        "indicador_pobreza_inei_2018": s["vulnerabilityIndex"],
        "quintil": s["vulnerabilityQuintile"],
        "pobreza": s["povertyRate"],
        "deficit_agua": s["waterAccessDeficit"],
        "deficit_saneamiento": s["sanitationDeficit"],
        "hacinamiento": s["overcrowdingRate"],
        "demanda_mensual": c["historicalDemand"],
        "demanda_proyectada": c["projectedDemand"],
        "capacidad_mensual": c["healthcareCapacity"],
        "presion_asistencial": c["systemPressure"],
        "accesibilidad": c["accessibilityIndex"],
        "tiempo_viaje_min": c["avgTravelTimeMinutes"],
        "prioridad": c["priorityIndex"],
        "categoria_hotspot": c["hotspotCategory"],
        "ipress_activas": t["activeFacilitiesCount"],
        "vecinos_ids": t["neighborIds"],
    }


def _slim_facility(f: dict) -> dict:
    return {
        "id": f["id"],
        "nombre": f["name"],
        "distrito": f["districtName"],
        "categoria": f["category"],
        "estado": f["operationalStatus"],
        "horario": f["schedule"],
        "capacidad_mensual": f["monthlyCapacity"],
        "demanda_mensual": f["currentMonthlyDemand"],
        "carga": f["pressureRatio"],
        "consultorios": f["consultingRooms"],
    }


# --------------------------------------------------------------------------- #
# Percepción                                                                    #
# --------------------------------------------------------------------------- #

@tool
def rank_hotspots(top_n: int = 5) -> list[dict]:
    """Distritos del Área Metropolitana de Trujillo ordenados por índice de
    prioridad sanitaria (0 a 1), de mayor a menor riesgo.

    Úsala para responder qué territorios se están complicando o cuáles deben
    priorizarse. Devuelve población, vulnerabilidad SDOH, presión asistencial,
    accesibilidad y categoría de hotspot de cada uno."""
    data = _get("/hotspots")
    return [_slim(t) for t in data["hotspots"][: max(1, min(top_n, 10))]]


def territory_detail(district_id: int) -> dict:
    """Territorio + IPRESS + atribución de factores en una sola llamada.

    `/territories/:id` ya devuelve todo eso junto; aprovecharlo evita tres
    peticiones separadas al motor por cada dictamen.
    """
    d = _get(f"/territories/{district_id}")
    return {
        "distrito": _slim(d["territory"]),
        "ipress": [_slim_facility(f) for f in d.get("facilities", [])],
        "factores_riesgo": [
            {
                "factor": e["factor"],
                "categoria": e["category"],
                "peso": e["weight"],
                "puntuacion": e["score"],
                "impacto": e["impact"],
            }
            for e in d.get("explanations", [])
        ],
    }


@tool
def get_territory(district_id: int) -> dict:
    """Ficha completa de un distrito por su ID numérico: determinantes sociales
    (pobreza, agua, saneamiento, hacinamiento), demanda y capacidad asistencial,
    accesibilidad geográfica, índice de prioridad e IDs de distritos vecinos.

    IDs: 1 Trujillo, 2 El Porvenir, 3 La Esperanza, 4 Florencia de Mora,
    5 Víctor Larco Herrera, 6 Huanchaco, 7 Moche, 8 Laredo, 9 Salaverry,
    10 Poroto."""
    return _slim(_get(f"/territories/{district_id}")["territory"])


@tool
def list_territories() -> list[dict]:
    """Los 10 distritos del área metropolitana con sus métricas actuales.
    Úsala cuando necesites comparar varios territorios entre sí."""
    return [_slim(t) for t in _get("/territories")["data"]]


@tool
def list_facilities(
    district_id: Optional[int] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
) -> list[dict]:
    """Establecimientos de salud (IPRESS) del catálogo RENIPRESS con su
    capacidad, demanda y carga asistencial.

    Filtros opcionales: district_id (1-10), category ('I-1' a 'III-1'),
    status ('Operativo', 'Sobrecargado', 'Mantenimiento', 'Cierre Temporal')."""
    data = _get("/facilities", districtId=district_id, category=category, status=status)
    return [_slim_facility(f) for f in data["data"]]


# --------------------------------------------------------------------------- #
# Modelado                                                                      #
# --------------------------------------------------------------------------- #

@tool
def get_forecast(district_id: int, horizon_months: int = 6) -> dict:
    """Consultas externas SIS observadas y proyección por persistencia estacional.

    IMPORTANTE: nunca estimes una proyección por tu cuenta. Si necesitas un
    valor futuro, llama a esta herramienta."""
    d = _get(f"/predictions/{district_id}", horizon=horizon_months)
    return {
        "distrito": d["districtName"],
        "modelo": d["modelVersion"],
        "serie": [
            {
                "mes": p["label"],
                "observado": p["historicalValue"],
                "predicho": p["predictedValue"],
                "banda_inferior": p["lowerConfidence"],
                "banda_superior": p["upperConfidence"],
                "es_proyeccion": p["isForecast"],
            }
            for p in d["forecast"]
        ],
    }


# --------------------------------------------------------------------------- #
# Análisis: simulador contrafáctico                                             #
# --------------------------------------------------------------------------- #

class InterventionArgs(BaseModel):
    """Parámetros de una intervención simulable en el gemelo."""

    target_district_id: int = Field(description="ID del distrito intervenido (1-10)")
    type: Literal[
        "new_facility", "expand_capacity", "improve_access", "temporary_closure"
    ] = Field(description="Tipo de intervención a simular")
    scenario_name: str = Field(
        default="Escenario del agente", description="Nombre descriptivo del escenario"
    )
    new_facility_category: Optional[str] = Field(
        default=None, description="Solo para new_facility: 'I-2', 'I-3', 'I-4' o 'II-1'"
    )
    new_facility_capacity: Optional[int] = Field(
        default=None, description="Solo para new_facility: atenciones por mes"
    )
    capacity_increase_pct: Optional[int] = Field(
        default=None, description="Solo para expand_capacity: 10 a 80"
    )
    travel_time_reduction_pct: Optional[int] = Field(
        default=None, description="Solo para improve_access: 10 a 50"
    )
    target_facility_id: Optional[str] = Field(
        default=None,
        description=(
            "Solo para temporary_closure: ID de la IPRESS, formato 'fac-5'. "
            "Si se omite, se simula una contingencia del 40% de la capacidad distrital."
        ),
    )


@tool(args_schema=InterventionArgs)
def simulate_intervention(**kwargs: Any) -> dict:
    """Ejecuta un escenario contrafáctico en el gemelo digital y devuelve el
    impacto: estado antes y después, deltas de prioridad, accesibilidad, presión
    y tiempo de viaje, más el efecto sobre los distritos vecinos.

    Es la ÚNICA forma válida de responder preguntas del tipo '¿qué pasa si...?'.
    Nunca estimes tú el resultado de una intervención."""
    params: dict[str, Any] = {
        "targetDistrictId": kwargs["target_district_id"],
        "type": kwargs["type"],
    }
    # snake_case (agente) -> camelCase (API). targetFacilityId es string: "fac-5".
    for snake, camel in (
        ("new_facility_category", "newFacilityCategory"),
        ("new_facility_capacity", "newFacilityCapacity"),
        ("capacity_increase_pct", "capacityIncreasePct"),
        ("travel_time_reduction_pct", "travelTimeReductionPct"),
        ("target_facility_id", "targetFacilityId"),
    ):
        if kwargs.get(snake) is not None:
            params[camel] = kwargs[snake]

    try:
        r = _twin.post(
            "/simulate",
            json={
                "params": params,
                "scenarioName": kwargs.get("scenario_name", "Escenario del agente"),
                "authorRole": "Agente LangChain",
            },
        )
        r.raise_for_status()
    except httpx.HTTPError as exc:
        raise TwinUnavailable(f"El simulador no respondió: {exc}") from exc

    res = r.json()["result"]
    return {
        "escenario": res["scenarioName"],
        "distrito": res["targetDistrict"]["name"],
        "antes": res["before"],
        "despues": res["after"],
        "deltas": res["deltas"],
        "vecinos_afectados": res["affectedNeighbors"],
        "dictamen_motor": res["verdict"],
    }


TWIN_TOOLS = [
    rank_hotspots,
    get_territory,
    list_territories,
    list_facilities,
    get_forecast,
    simulate_intervention,
]

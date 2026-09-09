"""Dos modos de uso del modelo sobre el gemelo digital.

`generar_dictamen` — ruta determinista. La pregunta "dame el dictamen del
distrito X" siempre requiere los mismos datos, así que no se gasta un turno del
modelo en descubrirlo: se recogen por código y el modelo solo redacta. Más
barato, más rápido y sin margen para que consulte lo que no debe.

`preguntar` — ruta abierta. Para conversación libre ("¿qué pasa si cierro el
C.S. de El Porvenir?") el modelo sí elige qué herramientas usar, encadena varias
si hace falta y mantiene el hilo por `thread_id`.

En ambos casos las cifras salen del motor. Lo que se recoge queda en `facts` y
viaja junto a la respuesta para que el investigador pueda auditarla.
"""

from __future__ import annotations

from typing import Any

from langchain.agents import create_agent
from langgraph.checkpoint.memory import InMemorySaver

from .llm import get_llm, model_name
from .tools import (
    TWIN_TOOLS,
    get_territory,
    rank_hotspots,
    territory_detail,
)

# --------------------------------------------------------------------------- #
# Prompts                                                                       #
# --------------------------------------------------------------------------- #

SYS_AGENTE = """Eres el analista del Gemelo Digital Urbano de Salud del Área \
Metropolitana de Trujillo (La Libertad, Perú). Asistes a investigadores, gestores \
de salud pública y planificadores territoriales.

REGLA INVIOLABLE: no calculas ni estimas cifras. Cada número que menciones debe \
provenir de una herramienta que hayas invocado en esta conversación. Si no tienes \
el dato, llama a la herramienta correspondiente; si aun así no existe, dilo \
explícitamente en vez de aproximar.

Para preguntas del tipo "¿qué pasa si...?" usa siempre simulate_intervention: \
nunca estimes tú el efecto de una intervención.

RESUELVE LOS NOMBRES TÚ MISMO. Nunca pidas al usuario un ID: para eso tienes las \
herramientas. Si menciona un establecimiento ("el C.S. Santa Isabel"), llama a \
list_facilities con el distrito y localiza su id (formato "fac-5"). Si menciona un \
distrito por su nombre, usa list_territories. Solo pregunta cuando la petición sea \
genuinamente ambigua entre dos opciones reales que ya hayas consultado.

Responde en español, con precisión técnica y sin adornos. Expresa los índices y \
ratios en porcentaje (0.88 → 88 %) e incluye siempre la unidad: atenciones/mes, \
minutos, habitantes. Cuando una conclusión dependa de un supuesto del modelo, \
márcalo como tal."""

SYS_DICTAMEN = """Eres especialista en epidemiología y salud pública del Gemelo \
Digital Urbano de Salud del Área Metropolitana de Trujillo, Perú.

Redacta un dictamen técnico breve y estructurado en Markdown con esta forma:

### Dictamen Técnico Epidemiológico — {distrito}
**1. Diagnóstico de situación** — interpreta prioridad, presión asistencial, \
accesibilidad y determinantes sociales. Relaciónalos entre sí; no los enumeres.
**2. Recomendación de intervención** — una acción priorizada y concreta \
(infraestructura, accesibilidad o equipamiento), justificada con los datos.
**3. Efecto esperado en la red** — qué ocurre con los distritos vecinos.

Cierra con una nota de no causalidad en cursiva.

REGLA INVIOLABLE: usa exclusivamente las cifras del bloque DATOS. No inventes ni \
redondees a valores que no aparezcan ahí. Si un dato no está, omite la afirmación.

FORMATO DE CIFRAS: los índices y ratios llegan en escala 0-1; exprésalos en \
porcentaje (0.88 → 88 %, 1.36 → 136 %). Los recuentos van con separador de miles \
(13950 → 13 950 atenciones/mes). Nunca escribas un ratio crudo como "0.44 de pobreza".

Perfil del lector: {rol}. Si es Gestor o Planificador, prioriza la decisión y su \
coste de oportunidad; si es Investigador, explicita método y limitaciones."""


# --------------------------------------------------------------------------- #
# Ruta determinista: dictamen de un distrito                                    #
# --------------------------------------------------------------------------- #

def recoger_hechos(district_id: int) -> dict[str, Any]:
    """Reúne por código todo lo que un dictamen necesita. Sin intervención del LLM.

    Devuelve el registro de evidencia: es lo único que verá el redactor y lo que
    se adjunta a la respuesta para que el dictamen sea reproducible.
    """
    detalle = territory_detail(district_id)
    return {
        **detalle,  # distrito, ipress, factores_riesgo
        # Los vecinos sustentan la sección de efecto en red del dictamen.
        "vecinos": [
            get_territory.invoke({"district_id": vid})
            for vid in detalle["distrito"].get("vecinos_ids", [])
        ],
        "ranking_metropolitano": rank_hotspots.invoke({"top_n": 5}),
    }


def generar_dictamen(district_id: int, rol: str = "Investigador") -> dict[str, Any]:
    """Dictamen técnico de un distrito, fundamentado en el motor del gemelo."""
    facts = recoger_hechos(district_id)
    nombre = facts["distrito"]["distrito"]

    respuesta = get_llm().invoke(
        [
            {
                "role": "system",
                "content": SYS_DICTAMEN.format(distrito=nombre, rol=rol),
            },
            {
                "role": "user",
                "content": (
                    f"DATOS DEL MOTOR (única fuente válida de cifras):\n{facts}\n\n"
                    f"Redacta el dictamen del distrito de {nombre}."
                ),
            },
        ]
    )

    return {
        "analysis": respuesta.content,
        "facts": facts,
        "modelUsed": model_name(),
    }


# --------------------------------------------------------------------------- #
# Ruta abierta: agente conversacional                                           #
# --------------------------------------------------------------------------- #

# En memoria: el historial vive mientras corra el proceso. Para persistirlo entre
# reinicios se cambia por SqliteSaver (ver documento de arquitectura, Sprint 2).
_checkpointer = InMemorySaver()
_agente = None


def _get_agente():
    """Construcción diferida: si falta la clave, que falle al usarlo y no al importar."""
    global _agente
    if _agente is None:
        _agente = create_agent(
            model=get_llm(),
            tools=TWIN_TOOLS,
            system_prompt=SYS_AGENTE,
            checkpointer=_checkpointer,
        )
    return _agente


def preguntar(
    pregunta: str,
    thread_id: str,
    district_id: int | None = None,
    month_key: str = "2026-08",
    user_role: str = "Investigador",
) -> dict[str, Any]:
    """Consulta conversacional con acceso a las seis herramientas del gemelo."""
    contexto = [f"Periodo de análisis: {month_key}.", f"Rol del usuario: {user_role}."]
    if district_id:
        contexto.append(
            f"El usuario tiene seleccionado el distrito con ID {district_id}; "
            f'si dice "este distrito" se refiere a ese.'
        )

    salida = _get_agente().invoke(
        {
            "messages": [
                {"role": "system", "content": " ".join(contexto)},
                {"role": "user", "content": pregunta},
            ]
        },
        config={"configurable": {"thread_id": thread_id}},
    )

    mensajes = salida["messages"]
    # Toda salida de herramienta se conserva: es la evidencia de la respuesta.
    evidencia = [
        {"herramienta": m.name, "resultado": m.content}
        for m in mensajes
        if getattr(m, "type", None) == "tool"
    ]

    return {
        "answer": mensajes[-1].content,
        "toolsUsed": [e["herramienta"] for e in evidencia],
        "facts": evidencia,
        "modelUsed": model_name(),
    }

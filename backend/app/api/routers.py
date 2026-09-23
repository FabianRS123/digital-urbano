"""Rutas de la capa agéntica.

Este servicio no duplica la API del gemelo: solo expone lo que necesita un LLM
para razonar sobre ella. Los datos siguen viniendo de Express (:3000), que es la
única fuente de verdad numérica.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agent.agent import generar_dictamen, preguntar, recoger_hechos
from app.agent.langflow_client import langflow_configured, pedir_recomendacion
from app.agent.llm import model_name, openrouter_configured
from app.agent.tools import TwinUnavailable

api_router = APIRouter()


@api_router.get("/agent/health")
def agent_health() -> dict:
    """Permite a Express saber si delegar o caer al dictamen determinista."""
    return {
        "status": "ok" if openrouter_configured() else "sin_clave",
        "provider": "openrouter",
        "model": model_name(),
        "llmReady": openrouter_configured(),
        "langflowReady": langflow_configured(),
    }


class DictamenRequest(BaseModel):
    districtId: int = Field(ge=1, le=10, description="ID del distrito (1-10)")
    userRole: str = "Investigador"


@api_router.post("/agent/dictamen")
def dictamen(req: DictamenRequest) -> dict:
    """Dictamen técnico de un distrito, con las cifras recogidas del motor."""
    try:
        return generar_dictamen(req.districtId, req.userRole)
    except TwinUnavailable as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:  # falta la clave de OpenRouter
        raise HTTPException(status_code=503, detail=str(exc)) from exc


class RecomendacionRequest(BaseModel):
    districtId: int = Field(ge=1, le=10)


@api_router.post("/agent/recomendacion")
def recomendacion(req: RecomendacionRequest) -> dict:
    """Recomendación operativa vía Langflow. El dictamen LangChain no cambia."""
    try:
        hechos = recoger_hechos(req.districtId)
        return pedir_recomendacion(hechos)
    except TwinUnavailable as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


class AskRequest(BaseModel):
    question: str = Field(min_length=1)
    threadId: str = Field(description="Identificador de la conversación")
    districtId: int | None = None
    monthKey: str = "2026-08"
    userRole: str = "Investigador"


@api_router.post("/agent/ask")
def ask(req: AskRequest) -> dict:
    """Consulta conversacional. El agente decide qué herramientas invocar."""
    try:
        return preguntar(
            pregunta=req.question,
            thread_id=req.threadId,
            district_id=req.districtId,
            month_key=req.monthKey,
            user_role=req.userRole,
        )
    except TwinUnavailable as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

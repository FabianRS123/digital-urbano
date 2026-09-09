"""Conexión al modelo vía OpenRouter.

OpenRouter es un enrutador multiproveedor con API compatible con OpenAI, así que
un solo cliente sirve para Claude, Gemini, Llama o el que se configure. El modelo
va en variable de entorno a propósito: los identificadores cambian con frecuencia
y no queremos recompilar para probar otro.

Requisito duro: el modelo elegido debe soportar *tool calling*. Sin eso el agente
de `agent.py` no puede consultar el gemelo y volveríamos a un LLM que inventa.
"""

from __future__ import annotations

import os
from functools import lru_cache

import truststore
from dotenv import load_dotenv
from langchain_openrouter import ChatOpenRouter

# Python trae su propio paquete de certificados e ignora el del sistema. En
# equipos con antivirus o proxy corporativo que inspecciona TLS, la conexión a
# OpenRouter falla con CERTIFICATE_VERIFY_FAILED aunque curl funcione.
# truststore hace que Python use el almacén de confianza de Windows/macOS.
truststore.inject_into_ssl()

# Carga backend/.env sin pisar variables ya presentes en el entorno del sistema.
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

DEFAULT_MODEL = "google/gemini-2.5-flash"

# En milisegundos, por la API de ChatOpenRouter (ver nota en get_llm).
REQUEST_TIMEOUT_MS = 60_000


def openrouter_configured() -> bool:
    """Permite a la API responder 503 con un motivo claro en vez de reventar."""
    return bool(os.getenv("OPENROUTER_API_KEY"))


@lru_cache(maxsize=4)
def get_llm(temperature: float = 0.2) -> ChatOpenRouter:
    """Cliente compartido. Se cachea para no reabrir conexiones en cada petición.

    temperature baja: un dictamen técnico debe ser reproducible, no creativo.
    """
    if not openrouter_configured():
        raise RuntimeError(
            "Falta OPENROUTER_API_KEY. Copia backend/.env.example a backend/.env "
            "y coloca tu clave de openrouter.ai/keys."
        )

    return ChatOpenRouter(
        model=os.getenv("OPENROUTER_MODEL", DEFAULT_MODEL),
        temperature=temperature,
        # OJO: ChatOpenRouter mide `timeout` en MILISEGUNDOS (mapea a
        # timeout_ms del SDK), no en segundos como el resto de LangChain.
        # Pasar 45 aquí significa 45 ms y provoca reintentos con backoff que
        # dejan la petición colgada varios minutos.
        timeout=REQUEST_TIMEOUT_MS,
        # Un solo reintento: si OpenRouter no responde, preferimos caer rápido
        # al dictamen determinista de Express antes que hacer esperar al usuario.
        max_retries=1,
    )


def model_name() -> str:
    """Identificador que se devuelve al frontend para trazabilidad del dictamen."""
    return os.getenv("OPENROUTER_MODEL", DEFAULT_MODEL)

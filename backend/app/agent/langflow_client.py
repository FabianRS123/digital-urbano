"""Cliente del flujo de Langflow. LangChain no pasa por aquí.

El dictamen y el chat siguen en `agent.py`. Este módulo solo pide a Langflow
una recomendación operativa corta a partir de hechos ya calculados.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

DEFAULT_BASE = "http://127.0.0.1:7860"
DEFAULT_FLOW = "d9b65054-25e0-43dd-9716-364b7948e951"


def langflow_configured() -> bool:
    return bool(os.getenv("LANGFLOW_API_KEY"))


def pedir_recomendacion(hechos: dict) -> dict:
    """Ejecuta el flujo `recomendacion_gemelo` y devuelve el texto."""
    api_key = os.getenv("LANGFLOW_API_KEY")
    if not api_key:
        raise RuntimeError(
            "Falta LANGFLOW_API_KEY en backend/.env. "
            "Es la clave de la API de Langflow, no la de OpenRouter."
        )

    base = os.getenv("LANGFLOW_URL", DEFAULT_BASE).rstrip("/")
    flow_id = os.getenv("LANGFLOW_FLOW_ID", DEFAULT_FLOW)
    payload = json.dumps(
        {
            "input_value": (
                "HECHOS DEL MOTOR (única fuente de cifras):\n"
                f"{json.dumps(hechos, ensure_ascii=False, default=str)}\n\n"
                "Redacta la recomendación operativa."
            ),
            "input_type": "chat",
            "output_type": "chat",
        }
    ).encode()
    request = urllib.request.Request(
        f"{base}/api/v1/run/{flow_id}?stream=false",
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "Accept-Encoding": "identity",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            body = json.loads(response.read().decode())
    except urllib.error.URLError as exc:
        raise RuntimeError(
            "Langflow no está disponible. Levántalo con: docker start trusting_goodall"
        ) from exc

    text = (
        body.get("outputs", [{}])[0]
        .get("outputs", [{}])[0]
        .get("results", {})
        .get("message", {})
        .get("text", "")
    )
    if not text:
        raise RuntimeError("Langflow respondió sin texto de recomendación.")
    return {
        "recomendacion": text,
        "flowId": flow_id,
        "origen": "langflow",
    }

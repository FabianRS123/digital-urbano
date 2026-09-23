"""Crea en Langflow el flujo de recomendación operativa del gemelo.

No toca el agente LangChain. El flujo solo recibe un texto con los hechos
del distrito y devuelve una recomendación corta.
"""
import copy
import json
import urllib.error
import urllib.request
import gzip

LF = "sk-40cR_j_5TIjwvpJk1pkE6P5LLDSqFECLokKQO03OR54"
PROJECT_ID = "ecc63a43-9310-4007-8e4f-7f713f5372f6"
MODEL = "google/gemini-2.5-flash"
SPECIAL = "\u0153"

SYSTEM_PROMPT = """Eres un planificador de salud pública del Gemelo Digital Urbano de Trujillo, Perú.
Recibes hechos ya calculados por el motor del gemelo. No inventes cifras.
Responde en español, en máximo 180 palabras, con este formato:
1) Prioridad del distrito en una frase.
2) Tres acciones operativas, cada una en una línea que empiece con "- ".
3) Una alerta de efecto en distritos vecinos, si los datos lo permiten.
Si faltan datos, dilo. No uses Markdown de títulos."""


def api(method, path, body=None, timeout=60):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        "http://localhost:7860" + path,
        data=data,
        method=method,
        headers={
            "x-api-key": LF,
            "Content-Type": "application/json",
            "Accept-Encoding": "gzip",
        },
    )
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        raw = resp.read()
        if raw[:2] == b"\x1f\x8b":
            raw = gzip.decompress(raw)
        return resp.status, json.loads(raw.decode()) if raw else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def handle(obj):
    return json.dumps(obj, ensure_ascii=False).replace('"', SPECIAL)


def edge(source, target, source_handle, target_handle):
    sh = handle(source_handle)
    th = handle(target_handle)
    return {
        "animated": False,
        "className": "",
        "data": {"sourceHandle": source_handle, "targetHandle": target_handle},
        "id": f"reactflow__edge-{source}{sh}-{target}{th}",
        "selected": False,
        "source": source,
        "sourceHandle": sh,
        "target": target,
        "targetHandle": th,
    }


def main():
    status, all_ = api("GET", "/api/v1/all")
    if status != 200:
        raise SystemExit(f"Langflow no respondió /api/v1/all: {status} {all_}")

    def node_from(category, name, node_id, position, display_name=None, updates=None):
        base = copy.deepcopy(all_[category][name])
        if updates:
            for key, value in updates.items():
                if key in base["template"] and isinstance(base["template"][key], dict):
                    base["template"][key]["value"] = value
        if display_name:
            base["display_name"] = display_name
        return {
            "data": {"id": node_id, "node": base, "showNode": True, "type": name},
            "id": node_id,
            "position": position,
            "type": "genericNode",
        }

    chat_in = node_from("input_output", "ChatInput", "ChatInput-reco", {"x": 80, "y": 220})
    chat_in["data"]["type"] = "ChatInput"
    chat_out = node_from("input_output", "ChatOutput", "ChatOutput-reco", {"x": 980, "y": 220})
    chat_out["data"]["type"] = "ChatOutput"
    agent = node_from(
        "models_and_agents",
        "Agent",
        "Agent-reco",
        {"x": 480, "y": 160},
        display_name="Recomendacion operativa",
        updates={
            "system_prompt": SYSTEM_PROMPT,
            "add_calculator_tool": False,
            "add_current_date_tool": False,
            "max_iterations": 2,
            "max_tokens": 500,
            "stream": False,
        },
    )
    agent["data"]["type"] = "Agent"
    template = agent["data"]["node"]["template"]
    template["model"]["value"] = [
        {
            "name": MODEL,
            "icon": "OpenRouter",
            "provider": "OpenRouter",
            "metadata": {
                "context_length": 1048576,
                "model_class": "ChatOpenAI",
                "model_name_param": "model",
                "api_key_param": "api_key",
                "max_tokens_field_name": "max_tokens",
                "reasoning": False,
            },
        }
    ]
    template["api_key"]["value"] = "OPENROUTER_API_KEY"
    template["api_key"]["load_from_db"] = True

    flow = {
        "name": "Recomendacion operativa gemelo",
        "description": "Recomendacion corta a partir de hechos del gemelo digital de Trujillo. No reemplaza el dictamen LangChain.",
        "endpoint_name": "recomendacion_gemelo",
        "folder_id": PROJECT_ID,
        "mcp_enabled": True,
        "action_name": "recomendacion_gemelo",
        "action_description": "Redacta una recomendacion operativa breve con los hechos de un distrito del gemelo.",
        "data": {
            "nodes": [chat_in, chat_out, agent],
            "edges": [
                edge(
                    "ChatInput-reco",
                    "Agent-reco",
                    {
                        "dataType": "ChatInput",
                        "id": "ChatInput-reco",
                        "name": "message",
                        "output_types": ["Message"],
                    },
                    {
                        "fieldName": "input_value",
                        "id": "Agent-reco",
                        "inputTypes": ["Message"],
                        "type": "str",
                    },
                ),
                edge(
                    "Agent-reco",
                    "ChatOutput-reco",
                    {
                        "dataType": "Agent",
                        "id": "Agent-reco",
                        "name": "response",
                        "output_types": ["Message"],
                    },
                    {
                        "fieldName": "input_value",
                        "id": "ChatOutput-reco",
                        "inputTypes": ["Data", "JSON", "DataFrame", "Table", "Message"],
                        "type": "other",
                    },
                ),
            ],
            "viewport": {"x": 0, "y": 0, "zoom": 0.9},
        },
    }

    status, created = api("POST", "/api/v1/flows/", flow)
    if status != 200 and status != 201:
        raise SystemExit(f"No se pudo crear el flujo: {status} {created}")
    flow_id = created["id"]
    print("FLOW_ID", flow_id)

    out = r"D:\SISTEMAS\CICLO X\TRABAJO DE INVETIGACION\S02\backend\langflow\recomendacion_gemelo.flow.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"id": flow_id, **flow}, f, indent=2, ensure_ascii=False)
    print("wrote", out)


if __name__ == "__main__":
    main()

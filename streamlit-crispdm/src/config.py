from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parent
SNAPSHOT_PATH = PROJECT_ROOT / "data" / "official-snapshot.json"
REPORTS_DIR = ROOT / "reports"
MODELS_DIR = ROOT / "models"

RANDOM_STATE = 42
TARGET_COL = "demand"
GROUP_COL = "district_code"

FOOTNOTE = (
    "**Interpretabilidad y explicabilidad:** Toda métrica, figura y tabla debe leerse "
    "como apoyo a la decisión, no como veredicto causal. Los valores provienen de fuentes "
    "públicas (SIS, INEI, RENIPRESS) agregadas a nivel distrital; las predicciones "
    "reflejan patrones históricos y covariables observables. Use importancias de "
    "variables, intervalos de confianza y pruebas inferenciales para explicar *por qué* "
    "un distrito presenta mayor demanda proyectada."
)

DATASET_SOURCES = {
    "sis": "SIS — Atenciones de asegurados (datosabiertos.gob.pe)",
    "population": "INEI — Población proyectada por distrito 2018–2026",
    "poverty": "INEI — Mapa de pobreza distrital 2018",
    "renipress": "SUSALUD — RENIPRESS (IPRESS provincia Trujillo)",
    "boundaries": "PCM/INEI — Límites censales distritales 2023",
}

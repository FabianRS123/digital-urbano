"""Figuras del artículo GDUS Trujillo, regeneradas desde los datos del repositorio."""

import sys
from pathlib import Path

# La validación temporal reutiliza el código de la aplicación CRISP-DM (src/data_loader.py y src/models.py).
_CRISP_DM = Path(__file__).resolve().parents[2] / "streamlit-crispdm"
if str(_CRISP_DM) not in sys.path:
    sys.path.append(str(_CRISP_DM))

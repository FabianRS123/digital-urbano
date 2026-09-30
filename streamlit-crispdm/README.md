# Motor CRISP-DM — Streamlit (GDUS Trujillo)

Aplicación Python/Streamlit que implementa la metodología **CRISP-DM** sobre el dataset público del Gemelo Digital Urbano de Salud (Trujillo).

## Datos

Usa `../data/official-snapshot.json` generado por el proyecto principal:

- **SIS** — Atenciones mensuales (datosabiertos.gob.pe)
- **INEI** — Población y pobreza distrital
- **RENIPRESS** — IPRESS provincia Trujillo
- **PCM/INEI** — Límites censales

## Fases CRISP-DM en la app

1. EDA
2. Entrenamiento
3. Selección del mejor modelo
4. Validación cruzada temporal
5. Hiperparámetros (GridSearchCV)
6. Pruebas estadísticas inferenciales (Friedman, Wilcoxon, bootstrap, residuos)
7. Reportes exportables

Todas las figuras y tablas incluyen pie de **interpretabilidad y explicabilidad**.

## Requisitos previos

Desde la raíz del proyecto S02:

```bash
pnpm data:sync -- --seed
```

## Instalación y ejecución

```bash
cd streamlit-crispdm
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
```

Abrir: **http://localhost:8501**

# Figuras y tablas del artículo (Streamlit)

Aplicación que regenera desde los datos las figuras del manuscrito *Gemelos digitales de salud urbana* (Trujillo, Perú), las compara con las imágenes del Word y permite filtrarlas por distrito, descargarlas y copiar o exportar sus tablas.

## Ejecución

```bash
cd streamlit-figuras
pip install -r requirements.txt
streamlit run app.py
```

Abrir **http://localhost:8501**. Requiere `data/official-snapshot.json` (ver `pnpm data:sync` en la raíz) y reutiliza `src/data_loader.py` y `src/models.py` de `../streamlit-crispdm`.

## Qué incluye

- **Resumen:** estado de las cifras verificadas contra el Word y acceso a cada figura.
- **Figuras 2, 3, 4, S1, S2 y S3:** una vista por figura con lo que demuestra, su pie y cuatro pestañas (figura, comparación con el Word, datos y cifras verificadas). Descarga en PNG (mismo tamaño en píxeles que el Word, 300 dpi), SVG, PDF y datos en Excel.
- **Tablas del artículo:** Tablas 2, 3, S2, S3 y S4 con el formato del manuscrito (coma decimal). Se pueden seleccionar y copiar con Ctrl+C, copiar con un botón, o exportar a CSV y Excel.
- **Filtro de ubicación (barra lateral):** sin elegir nada se muestran los diez distritos y cada figura es idéntica a la del Word. Si se eligen uno o varios distritos, la figura o tabla se recalcula solo con ellos:
  - Figura 2: el mapa se acerca a los distritos elegidos y deja el resto en gris, con la misma escala de color.
  - Figura 3: un panel por distrito elegido.
  - Figura 4: solo las filas de los distritos elegidos.
  - Figura S1: el error (panel A) se mide solo en esos distritos; la importancia de variables (panel B) es la del modelo con los diez.
  - Figura S2: promedios por quintil e índices de concentración con los distritos elegidos (el índice requiere al menos tres).
  - Figura S3: ranking base y primer lugar entre los distritos elegidos (mínimo dos).
  - Tablas 2, 3 y S2 también responden al filtro; S3 y S4 no.

## Estructura

| Ruta | Contenido |
|---|---|
| `app.py` | Navegación, tema y filtro de ubicación |
| `paginas.py`, `interfaz.py` | Páginas y componentes visuales (tablas con copiar y exportar) |
| `figuras/modelo.py` | Port a Python del motor TypeScript (`src/lib/officialModel.ts`, `simulationEngine.ts`, `scripts/evaluate.ts`) |
| `figuras/datos.py` | Validación cruzada temporal y sensibilidad de pesos (réplica con NumPy, semilla 42) |
| `figuras/construir.py` | Dibujo de cada figura, con y sin filtro |
| `figuras/tablas.py` | Tablas 2, 3, S2, S3 y S4 |
| `figuras/verificacion.py` | Cifras del Word recalculadas y comparadas (249 comprobaciones) |
| `assets/word/` | Imágenes originales extraídas del Word, usadas solo para comparar |

## Verificación

De las 249 cifras del Word que se recalculan, 247 coinciden. Las dos restantes son diferencias del manuscrito, no de la aplicación: el MAPE de la persistencia del último mes aparece como 9,9 (valor exacto 9,85, redondeado dos veces) y la pobreza total de la Tabla 2 como 14,1 (valor exacto 14,05). Además, la "persistencia estacional" de la Tabla 3 y la Figura S1A proviene de `run_baseline`, que usa el último mes de entrenamiento y no el mismo mes del año anterior; con una persistencia t−12 real el MAE sería 640,0 y Wilcoxon daría W = 2, p = 0,19.

# Evaluación reproducible GDUS Trujillo

Versión: **0a3df2083b0c845c**. Consultas SIS: **2025-12**. Generado: 2026-09-23T18:04:59.944Z.

## Alcance y métodos

Diez distritos; Simbal y Alto Trujillo excluidos. Las consultas externas SIS son sumas de ATENCIONES (código 56), no personas. Población INEI por año; pobreza INEI 2018 como punto medio del intervalo. Capacidad: percentil 95 de doce meses con al menos seis observaciones; accesibilidad: distancia geográfica × 1,3 a 20 km/h más cinco minutos. Los efectos de intervención y vecinos son supuestos fijos.

Los efectos fijos sobre vecinos son −6,5 % para nueva IPRESS o ampliación, −2,0 % para mejora de acceso y +14,2 % para cierre temporal. Son hipótesis no validadas; las comparaciones no son estimaciones causales.

## RQ1

Líneas base comprobadas: 10; discrepancias: 0. Escenarios: 40; discrepancias numéricas: 0; violaciones metamórficas: 0. Paridad Python: 50 casos, 0 discrepancias. La prueba compara prioridad antes y después y dirección de efectos.

El fixture sintético original se estudia por separado en `rq1-prototype-fixture.csv`: 10 de diez líneas base difieren de la fórmula actual. Estas cifras no se usan en la app.

## RQ2

Índice de concentración ponderado por población, ordenado por pobreza ascendente. IC positivo significa concentración en la población con mayor pobreza. Bootstrap de distritos de 5 000 réplicas, semilla 1; intervalos orientativos con solo diez unidades. Las cinco reglas del artículo son prioridad, presión, demanda, población y asignación aleatoria, más óptimo ex post. Se repite con y sin efectos fijos sobre vecinos. Ver CSV para cifras y distritos seleccionados.

- accessDeficit: IC 0.030 [-0.163, 0.140]; Q5/Q1 1.46.
- travelMinutes: IC 0.031 [-0.247, 0.207]; Q5/Q1 1.57.
- pressure: IC 0.004 [-0.020, 0.024]; Q5/Q1 1.00.
- facilitiesPer10k: IC 0.039 [-0.158, 0.144]; Q5/Q1 1.54.

### Comparación de focalización

En esta versión, la línea base no tiene distritos de categoría Alta o Crítica; por eso el cambio de población en esas categorías es cero en estos escenarios y no discrimina reglas.

| Intervención | Vecinos | Regla | Distrito | Δ prioridad media | Δ IC déficit acceso | Δ IC presión |
|---|---|---|---|---:|---:|---:|
| new_facility | Sí | Máxima prioridad | Salaverry | -0.0034 | 0.0007 | 0.0009 |
| new_facility | Sí | Máxima presión | Poroto | -0.0010 | -0.0029 | -0.0031 |
| new_facility | Sí | Máxima demanda | Trujillo | -0.0277 | 0.1906 | -0.0017 |
| new_facility | Sí | Máxima población | Trujillo | -0.0277 | 0.1906 | -0.0017 |
| new_facility | Sí | Óptimo ex post | Trujillo | -0.0277 | 0.1906 | -0.0017 |
| new_facility | Sí | Aleatoria (esperanza exacta) | todos | -0.0137 | 0.0025 | 0.0007 |
| new_facility | No | Máxima prioridad | Salaverry | -0.0025 | 0.0007 | 0.0001 |
| new_facility | No | Máxima presión | Poroto | -0.0005 | -0.0029 | -0.0033 |
| new_facility | No | Máxima demanda | Trujillo | -0.0191 | 0.1906 | 0.0123 |
| new_facility | No | Máxima población | Trujillo | -0.0191 | 0.1906 | 0.0123 |
| new_facility | No | Óptimo ex post | La Esperanza | -0.0198 | -0.0715 | -0.0210 |
| new_facility | No | Aleatoria (esperanza exacta) | todos | -0.0080 | 0.0025 | -0.0044 |
| expand_capacity | Sí | Máxima prioridad | Salaverry | -0.0025 | 0.0002 | 0.0008 |
| expand_capacity | Sí | Máxima presión | Poroto | -0.0008 | -0.0009 | -0.0008 |
| expand_capacity | Sí | Máxima demanda | Trujillo | -0.0277 | 0.0685 | 0.0476 |
| expand_capacity | Sí | Máxima población | Trujillo | -0.0277 | 0.0685 | 0.0476 |
| expand_capacity | Sí | Óptimo ex post | Trujillo | -0.0277 | 0.0685 | 0.0476 |
| expand_capacity | Sí | Aleatoria (esperanza exacta) | todos | -0.0115 | 0.0012 | 0.0055 |
| expand_capacity | No | Máxima prioridad | Salaverry | -0.0016 | 0.0002 | 0.0001 |
| expand_capacity | No | Máxima presión | Poroto | -0.0003 | -0.0009 | -0.0011 |
| expand_capacity | No | Máxima demanda | Trujillo | -0.0191 | 0.0685 | 0.0603 |
| expand_capacity | No | Máxima población | Trujillo | -0.0191 | 0.0685 | 0.0603 |
| expand_capacity | No | Óptimo ex post | Trujillo | -0.0191 | 0.0685 | 0.0603 |
| expand_capacity | No | Aleatoria (esperanza exacta) | todos | -0.0058 | 0.0012 | 0.0003 |
| improve_access | Sí | Máxima prioridad | Salaverry | -0.0009 | 0.0005 | 0.0002 |
| improve_access | Sí | Máxima presión | Poroto | -0.0002 | -0.0021 | 0.0001 |
| improve_access | Sí | Máxima demanda | Trujillo | -0.0180 | 0.1691 | -0.0038 |
| improve_access | Sí | Máxima población | Trujillo | -0.0180 | 0.1691 | -0.0038 |
| improve_access | Sí | Óptimo ex post | Trujillo | -0.0180 | 0.1691 | -0.0038 |
| improve_access | Sí | Aleatoria (esperanza exacta) | todos | -0.0053 | 0.0042 | 0.0016 |
| improve_access | No | Máxima prioridad | Salaverry | -0.0009 | 0.0005 | 0.0000 |
| improve_access | No | Máxima presión | Poroto | -0.0002 | -0.0021 | -0.0000 |
| improve_access | No | Máxima demanda | Trujillo | -0.0159 | 0.1691 | 0.0005 |
| improve_access | No | Máxima población | Trujillo | -0.0159 | 0.1691 | 0.0005 |
| improve_access | No | Óptimo ex post | Trujillo | -0.0159 | 0.1691 | 0.0005 |
| improve_access | No | Aleatoria (esperanza exacta) | todos | -0.0044 | 0.0042 | 0.0000 |

## RQ3

10 000 pesos Dirichlet por concentración 20, 50 y 100; semilla 42. Se calcula concordancia de ranking y frecuencia de cambios de categoría usando la misma fórmula de prioridad.

- α=20: τ medio 0.928, primero estable 0.671, cambios de categoría 0.014.
- α=50: τ medio 0.953, primero estable 0.782, cambios de categoría 0.003.
- α=100: τ medio 0.966, primero estable 0.880, cambios de categoría 0.000.

## Trazabilidad de textos

10 salidas de plantilla determinista examinadas contra sus hechos. No se han evaluado respuestas libres del agente; no se infiere una tasa general de fidelidad.

## Correspondencia con el artículo

| Elemento | Estado actual | Cambio en el Word |
|---|---|---|
| Población, RENIPRESS, SIS, límites | Fuentes oficiales procesadas | Sustituir descripción de datos sintéticos y publicar fechas/versiones |
| Pobreza | Intervalo INEI 2018; punto medio derivado | Declarar desfase temporal y aproximación |
| Otros determinantes SDOH | Sin dato | Eliminar afirmaciones y tablas basadas en variables inventadas |
| Capacidad, acceso, prioridad | Estimaciones explícitas | Reescribir método y limitaciones |
| Pronóstico | Persistencia estacional, evaluación temporal | Retirar ST-GNN y métricas precargadas |
| RQ1–RQ3 | Resultados nuevos en CSV/JSON | Recalcular todas las tablas, figuras, resumen y conclusiones |
| Intervenciones | Efectos hipotéticos fijos | Declarar que no son efectos causales observados |

## Fuentes

- Población proyectada por distrito (2018–2026; consultado 2026-09-23T17:43:25.854Z): [página](https://www.gob.pe/institucion/inei/informes-publicaciones/6894980-peru-), [recurso](https://cdn.www.gob.pe/uploads/document/file/8261096/6894980-peru-poblacion-total-proyectada-al-30-de-junio-de-cada-ano-segun-departamento-provincia-y-distrito-2018-2026.xlsx?v=1768402069).
- Mapa de pobreza distrital (2018; consultado 2026-09-23T17:43:27.751Z): [página](https://www.gob.pe/institucion/inei/informes-publicaciones/3204872-mapa-de-pobreza-provincial-y-distrital-2018), [recurso](https://cdn.www.gob.pe/uploads/document/file/3340937/Anexo%20Estad%C3%ADstico.xlsx?v=1656708741).
- Límites censales distritales (2023; consultado 2026-09-23T17:56:34.596Z): [página](https://geosdot.servicios.gob.pe/visor/), [recurso](https://geosdot.servicios.gob.pe/geoserver/geoportal/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=geoportal:v_distritos_2023&outputFormat=application/json&srsName=EPSG:4326&CQL_FILTER=ubigeo%20LIKE%20'1301%25').
- RENIPRESS · SUSALUD (2026-08; consultado 2026-09-23T17:44:12.560Z): [página](https://www.datosabiertos.gob.pe/dataset/registro-nacional-de-entidades-prestadoras-de-servicios-de-salud-renipress), [recurso](https://www.datosabiertos.gob.pe/sites/default/files/RENIPRESS_31-08-2026.csv).
- Atenciones de asegurados SIS (2024-01–2025-12; consultado 2026-09-23T18:02:46.918Z): [página](https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis), [recurso](https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2025_07_12_ATENCIONES.zip).

### Recursos SIS descargados

- [ZIP SIS](https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2024_01_06_ATENCIONES.zip)
- [ZIP SIS](https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2024_07_12_ATENCIONES.zip)
- [ZIP SIS](https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2025_01_06_ATENCIONES.zip)
- [ZIP SIS](https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2025_07_12_ATENCIONES.zip)

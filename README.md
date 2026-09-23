# Gemelo Digital Urbano de Salud · Trujillo

Plataforma académica para explorar consultas externas de asegurados SIS y escenarios hipotéticos en diez distritos de Trujillo. Las cifras de entrada proceden de fuentes oficiales. La capacidad, el viaje geográfico, la prioridad y los efectos de las intervenciones son estimaciones del modelo.

## Ejecutar

Requiere Node.js 22 y pnpm. Desde la raíz del proyecto:

```sh
pnpm install
pnpm dev
```

La app y la API se sirven en `http://localhost:3000`. La copia procesada incluida en `data/official-snapshot.json` permite arrancar sin Internet. El servidor consulta cambios si han pasado 24 horas desde la última comprobación. Una descarga fallida conserva la última copia válida. El estado y el error aparecen en **Fuentes de datos**.

```sh
pnpm data:sync
pnpm data:verify
pnpm research:evaluate
pnpm lint
pnpm build
```

`data:sync` descarga ZIP de SIS a `.cache/sis` y los procesa por streaming. La copia publicada guarda solo agregados por mes, distrito e IPRESS; los ZIP quedan en caché local, ignorada por Git, para comprobar cambios y reintentar. `research:evaluate` trabaja con la versión local y escribe CSV, JSON e informe en `research/results/<versión>/`. Se puede exigir una versión con `pnpm research:evaluate -- --version=<versión>`.

## Fuentes y periodos

| Entrada | Periodo integrado | Recurso |
|---|---|---|
| [RENIPRESS, SUSALUD](https://www.datosabiertos.gob.pe/dataset/registro-nacional-de-entidades-prestadoras-de-servicios-de-salud-renipress) | agosto de 2026 | CSV enlazado en la app |
| [Atenciones, SIS](https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis) | enero de 2024 a diciembre de 2025 | cuatro ZIP enlazados en la app |
| [Población distrital, INEI](https://www.gob.pe/institucion/inei/informes-publicaciones/6894980-peru-) | proyecciones 2018–2026 | XLSX enlazado en la app |
| [Mapa de pobreza, INEI](https://www.gob.pe/institucion/inei/informes-publicaciones/3204872-mapa-de-pobreza-provincial-y-distrital-2018) | 2018 | XLSX enlazado en la app |
| [Límites censales, PCM/INEI](https://geosdot.servicios.gob.pe/visor/) | 2023 | WFS enlazado en la app |

Los UBIGEO se guardan como cadenas de seis dígitos y los códigos IPRESS como cadenas de ocho. Se analizan Trujillo, El Porvenir, La Esperanza, Florencia de Mora (`130103`), Víctor Larco Herrera, Huanchaco (`130104`), Moche, Laredo, Salaverry y Poroto. Simbal (`130110`) y Alto Trujillo (`130112`) están excluidos; sus registros no se reasignan.

## Indicadores y supuestos

- **Consultas externas SIS**: suma de `ATENCIONES` cuando `COD_SERVICIO=56`. Cada fila puede representar varias atenciones; no equivale a pacientes únicos ni a toda la demanda de salud.
- **Población**: proyección distrital INEI del año del mes consultado. **Pobreza**: punto medio del intervalo publicado para 2018, dividido entre 100. Otros determinantes sociales quedan `Sin dato`.
- **Capacidad de referencia**: percentil 95 de consultas mensuales SIS por IPRESS en los últimos doce meses disponibles, con seis meses válidos como mínimo. Se usa la mediana de IPRESS de la misma categoría con cobertura suficiente si falta historial. La cifra representa actividad histórica de referencia, no aforo físico ni personal contratado.
- **Accesibilidad**: desde el centro representativo del polígono distrital a la IPRESS pública de primer nivel más cercana; distancia geográfica × 1,3, velocidad supuesta de 20 km/h, cinco minutos adicionales. `A=exp(−tiempo/30)`. No se usan rutas viales reales.
- **Prioridad**: combinación de pobreza, presión `consultas SIS / capacidad estimada`, déficit de accesibilidad y presión de distritos colindantes. La vecindad proviene de geometrías Polygon/MultiPolygon. La fórmula y sus pesos están en `src/lib/simulationEngine.ts`.
- **Pronóstico**: persistencia estacional del mismo mes del año anterior, con último mes observado como respaldo. Se compara retrospectivamente con persistencia del último mes. No hay una ST-GNN entrenada.
- **Intervenciones**: nueva IPRESS, ampliación, mejora de acceso y cierre temporal. Sus cambios en acceso, capacidad y presión de vecinos son supuestos fijos, no efectos causales medidos.

| Intervención | Supuesto local por defecto | Presión de cada vecino |
|---|---|---|
| Nueva IPRESS | +2 200 consultas de referencia, +0,24 de acceso, tiempo × 0,70 | −6,5 % |
| Ampliación | +35 % de referencia, +0,08 de acceso, tiempo × 0,88 | −6,5 % |
| Mejora de acceso | −25 % de tiempo, +0,175 de acceso | −2,0 % |
| Cierre temporal | −40 % de referencia, −0,20 de acceso, tiempo × 1,35 | +14,2 % |

Los topes y mínimos del motor están en `src/lib/simulationEngine.ts`. Estos valores proceden del prototipo del artículo y carecen de calibración causal con la nueva base oficial.

La API `GET /api/v1/bootstrap?month=AAAA-MM` entrega territorios, catálogo RENIPRESS, meses SIS, fuentes, versión y métricas calculadas. `POST /api/v1/data-sources/sync` inicia una única sincronización; `GET` a la misma ruta informa el progreso. Las operaciones de simulación y dictamen deben enviar `datasetVersion` y `monthKey`; si cambió la versión, la API solicita recargar.

## Evaluación del artículo

`research:evaluate` vuelve a calcular RQ1 (consistencia, paridad TypeScript/Python y 40 escenarios), RQ2 (concentración ponderada, cinco reglas de focalización y bootstrap de 5 000 réplicas, semilla 1) y RQ3 (10 000 pesos Dirichlet para concentraciones 20, 50 y 100, semilla 42). El informe contiene la tabla de correspondencia con el artículo. Las cifras del Word describen el prototipo anterior y no son resultados verificados con estos datos.

Los datos numéricos inventados del prototipo se conservan solo en `research/fixtures/trujilloPrototype.ts` para reproducir y estudiar sus defectos. La app no importa ese archivo.

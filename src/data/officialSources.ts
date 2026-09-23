export const OFFICIAL_SOURCES = {
  renipress: {
    id: 'renipress', name: 'RENIPRESS · SUSALUD', institution: 'SUSALUD',
    pageUrl: 'https://www.datosabiertos.gob.pe/dataset/registro-nacional-de-entidades-prestadoras-de-servicios-de-salud-renipress',
    resourceUrl: 'https://www.datosabiertos.gob.pe/sites/default/files/RENIPRESS_31-08-2026.csv',
    period: '2026-08',
  },
  sis: {
    id: 'sis', name: 'Atenciones de asegurados SIS', institution: 'SIS',
    pageUrl: 'https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis',
    resourceUrl: 'https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2025_07_12_ATENCIONES.zip',
    period: '2024-01–2025-12',
  },
  population: {
    id: 'population', name: 'Población proyectada por distrito', institution: 'INEI',
    pageUrl: 'https://www.gob.pe/institucion/inei/informes-publicaciones/6894980-peru-',
    resourceUrl: 'https://cdn.www.gob.pe/uploads/document/file/8261096/6894980-peru-poblacion-total-proyectada-al-30-de-junio-de-cada-ano-segun-departamento-provincia-y-distrito-2018-2026.xlsx?v=1768402069',
    period: '2018–2026',
  },
  poverty: {
    id: 'poverty', name: 'Mapa de pobreza distrital', institution: 'INEI',
    pageUrl: 'https://www.gob.pe/institucion/inei/informes-publicaciones/3204872-mapa-de-pobreza-provincial-y-distrital-2018',
    resourceUrl: 'https://cdn.www.gob.pe/uploads/document/file/3340937/Anexo%20Estad%C3%ADstico.xlsx?v=1656708741',
    period: '2018',
  },
  boundaries: {
    id: 'boundaries', name: 'Límites censales distritales', institution: 'PCM / INEI',
    pageUrl: 'https://geosdot.servicios.gob.pe/visor/',
    resourceUrl: "https://geosdot.servicios.gob.pe/geoserver/geoportal/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=geoportal:v_distritos_2023&outputFormat=application/json&srsName=EPSG:4326&CQL_FILTER=ubigeo%20LIKE%20'1301%25'",
    period: '2023',
  },
} as const;

export const SIS_ARCHIVES = [
  'OPENDATA_DS_01_2024_01_06_ATENCIONES.zip',
  'OPENDATA_DS_01_2024_07_12_ATENCIONES.zip',
  'OPENDATA_DS_01_2025_01_06_ATENCIONES.zip',
  'OPENDATA_DS_01_2025_07_12_ATENCIONES.zip',
].map((filename) => `https://www.datosabiertos.gob.pe/sites/default/files/${filename}`);

export const DISTRICTS = [
  { id: 1, code: '130101', name: 'Trujillo' },
  { id: 2, code: '130102', name: 'El Porvenir' },
  { id: 3, code: '130105', name: 'La Esperanza' },
  { id: 4, code: '130103', name: 'Florencia de Mora' },
  { id: 5, code: '130111', name: 'Víctor Larco Herrera' },
  { id: 6, code: '130104', name: 'Huanchaco' },
  { id: 7, code: '130107', name: 'Moche' },
  { id: 8, code: '130106', name: 'Laredo' },
  { id: 9, code: '130109', name: 'Salaverry' },
  { id: 10, code: '130108', name: 'Poroto' },
] as const;

import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { Territory } from '../../types';

/**
 * Los polígonos del dataset están en orden Leaflet `[lat, lng]`.
 * MapLibre / GeoJSON exigen `[lng, lat]`, y el anillo debe estar cerrado.
 */
function toGeoJsonRing(coords: [number, number][]): [number, number][] {
  const ring: [number, number][] = coords.map(([lat, lng]) => [lng, lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

export interface DistrictFeatureProps {
  id: number;
  name: string;
  score: number;
  color: string;
  selected: number;
  simulated: number;
  [key: string]: unknown;
}

export type DistrictFeature = Feature<Polygon, DistrictFeatureProps>;

export function buildDistrictCollection(
  territories: Territory[],
  options: {
    /** Puntuación 0–1 usada para colorear cada distrito. */
    scoreOf: (t: Territory) => number;
    colorOf: (score: number) => string;
    selectedId?: number | null;
    simulatedId?: number | null;
  },
): FeatureCollection<Polygon, DistrictFeatureProps> {
  return {
    type: 'FeatureCollection',
    features: territories.map((t) => {
      const score = options.scoreOf(t);
      return {
        type: 'Feature',
        id: t.id,
        geometry: {
          type: 'Polygon',
          coordinates: t.geoJsonCoords.map(toGeoJsonRing),
        },
        properties: {
          id: t.id,
          name: t.name,
          score,
          color: options.colorOf(score),
          selected: options.selectedId === t.id ? 1 : 0,
          simulated: options.simulatedId === t.id ? 1 : 0,
        },
      } satisfies DistrictFeature;
    }),
  };
}

/** Centro del área metropolitana de Trujillo, en orden `[lng, lat]`. */
export const TRUJILLO_CENTER: [number, number] = [-79.015, -8.105];
export const TRUJILLO_ZOOM = 11.2;

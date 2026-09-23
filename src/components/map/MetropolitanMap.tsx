import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Crosshair, Layers, MapPin } from 'lucide-react';
import {
  Map,
  MapControls,
  MapGeoJSON,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  useMap,
  type MapRef,
} from '../ui/map';
import { Checkbox } from '../ui/Field';
import { HealthFacility, Territory } from '../../types';
import { cn } from '../../lib/utils';
import { formatNumber, formatPercent } from '../../lib/format';
import { RISK_SCALE, getRiskLevel, readCssColor } from '../../lib/risk';
import { useThemeContext } from '../../app/ThemeProvider';
import {
  TRUJILLO_CENTER,
  TRUJILLO_ZOOM,
  buildDistrictCollection,
  type DistrictFeatureProps,
} from './mapGeo';

type ChoroplethLayer = 'priority' | 'vulnerability';

export interface SimulationOverlay {
  targetDistrictId: number;
  beforePriority: number;
  afterPriority: number;
}

interface MetropolitanMapProps {
  territories: Territory[];
  facilities: HealthFacility[];
  selectedDistrictId: number | null;
  onSelectDistrict: (id: number) => void;
  simulationOverlay?: SimulationOverlay | null;
  className?: string;
  /** Oculta el panel de capas para usos incrustados. */
  compact?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Utilidades internas                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Id de la primera capa de símbolos del basemap: insertar los polígonos
 * antes de ella mantiene legibles los rótulos de calles y lugares.
 */
function useLabelLayerAnchor(): string | undefined {
  const { map, isLoaded } = useMap();
  const [anchor, setAnchor] = useState<string | undefined>();

  useEffect(() => {
    if (!map || !isLoaded) return;
    const symbol = map
      .getStyle()
      ?.layers?.find((layer) => layer.type === 'symbol');
    setAnchor(symbol?.id);
  }, [map, isLoaded]);

  return anchor;
}

/**
 * Reencuadra el mapa cuando cambia el distrito seleccionado.
 * La primera selección no dispara el vuelo: la vista inicial debe ser la
 * panorámica metropolitana, no un acercamiento al distrito por defecto.
 */
const FlyToDistrict: React.FC<{
  target: Territory | undefined;
  /** Fuerza el encuadre inicial (comparador de escenarios). */
  focusOnMount?: boolean;
}> = ({ target, focusOnMount = false }) => {
  const { map, isLoaded } = useMap();
  const lastId = useRef<number | null>(null);
  const primed = useRef(focusOnMount);

  useEffect(() => {
    if (!map || !isLoaded || !target) return;
    if (lastId.current === target.id) return;
    lastId.current = target.id;

    if (!primed.current) {
      primed.current = true;
      return;
    }

    map.flyTo({
      center: [target.coordinates.lng, target.coordinates.lat],
      zoom: 12.4,
      duration: 900,
      essential: true,
    });
  }, [map, isLoaded, target]);

  return null;
};

/** Controles del mapa: los nativos de mapcn más un reencuadre general. */
const MapToolbar: React.FC = () => {
  const { map } = useMap();

  return (
    <div className="absolute right-2 top-2 z-10 flex flex-col gap-1.5">
      <MapControls className="static" showZoom showCompass showFullscreen />
      <div className="overflow-hidden rounded-md border border-border bg-background shadow-sm">
        <button
          type="button"
          title="Vista general metropolitana"
          aria-label="Vista general metropolitana"
          onClick={() =>
            map?.flyTo({
              center: TRUJILLO_CENTER,
              zoom: TRUJILLO_ZOOM,
              bearing: 0,
              pitch: 0,
              duration: 800,
            })
          }
          className="flex size-8 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
        >
          <Crosshair className="size-4" />
        </button>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Mapa                                                                        */
/* -------------------------------------------------------------------------- */

export const MetropolitanMap: React.FC<MetropolitanMapProps> = ({
  territories,
  facilities,
  selectedDistrictId,
  onSelectDistrict,
  simulationOverlay,
  className,
  compact = false,
}) => {
  const { theme } = useThemeContext();
  const mapRef = useRef<MapRef | null>(null);

  const [layer, setLayer] = useState<ChoroplethLayer>('priority');
  const [showFacilities, setShowFacilities] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [panelOpen, setPanelOpen] = useState(!compact);
  const [hovered, setHovered] = useState<DistrictFeatureProps | null>(null);

  // Colores resueltos desde las variables CSS del tema activo.
  const palette = useMemo(
    () => ({
      low: readCssColor('--risk-low'),
      medium: readCssColor('--risk-medium'),
      high: readCssColor('--risk-high'),
      critical: readCssColor('--risk-critical'),
      primary: readCssColor('--primary'),
      info: readCssColor('--info'),
      negative: readCssColor('--negative'),
      foreground: readCssColor('--foreground'),
      surface: readCssColor('--surface'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme],
  );

  const colorForScore = useMemo(
    () => (score: number) => {
      if (score >= 0.8) return palette.critical;
      if (score >= 0.6) return palette.high;
      if (score >= 0.4) return palette.medium;
      return palette.low;
    },
    [palette],
  );

  const districtData = useMemo(
    () =>
      buildDistrictCollection(territories, {
        scoreOf: (t) =>
          layer === 'vulnerability'
            ? t.sdoh.vulnerabilityIndex
            : simulationOverlay?.targetDistrictId === t.id
              ? simulationOverlay.afterPriority
              : t.currentState.priorityIndex ?? 0,
        colorOf: colorForScore,
        selectedId: selectedDistrictId,
        simulatedId: simulationOverlay?.targetDistrictId ?? null,
      }),
    [territories, layer, simulationOverlay, selectedDistrictId, colorForScore],
  );

  const selectedTerritory = territories.find((t) => t.id === selectedDistrictId);

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-xl border border-border bg-muted shadow-xs',
        className ?? 'h-[520px]',
      )}
    >
      <Map
        ref={mapRef}
        className="size-full"
        center={TRUJILLO_CENTER}
        zoom={TRUJILLO_ZOOM}
        minZoom={9}
        maxZoom={17}
        attributionControl={{ compact: true }}
      >
        <DistrictLayers
          data={districtData}
          palette={palette}
          onSelectDistrict={onSelectDistrict}
          onHover={setHovered}
        />

        <FlyToDistrict target={selectedTerritory} focusOnMount={compact} />

        {showLabels &&
          territories.map((t) => (
            <MapMarker
              key={`label-${t.id}`}
              longitude={t.coordinates.lng}
              latitude={t.coordinates.lat}
              offset={[0, -9]}
            >
              <MarkerContent className="pointer-events-none">
                <span
                  className={cn(
                    'whitespace-nowrap rounded-[3px] border px-1.5 py-px text-[9.5px] font-semibold uppercase leading-4 tracking-[0.09em] backdrop-blur-[1px]',
                    t.id === selectedDistrictId
                      ? 'border-foreground/25 bg-background/90 text-foreground'
                      : 'border-transparent bg-background/72 text-foreground/75',
                  )}
                >
                  {t.name}
                </span>
              </MarkerContent>
            </MapMarker>
          ))}

        {showFacilities &&
          facilities.filter((facility) => facility.operationalStatus === 'Operativo' && facility.latitude !== null && facility.longitude !== null).map((facility) => {
            const isHospital =
              facility.category.startsWith('II') ||
              facility.category.startsWith('III');
            const isOverloaded = facility.pressureRatio !== null && facility.pressureRatio > 1;
            const color = isOverloaded
              ? palette.negative
              : isHospital
                ? palette.info
                : palette.primary;

            return (
              <MapMarker
                key={facility.id}
                longitude={facility.longitude}
                latitude={facility.latitude}
                onClick={() => onSelectDistrict(facility.districtId)}
              >
                <MarkerContent>
                  <span
                    className="block rounded-full transition-transform duration-150 hover:scale-150"
                    style={{
                      width: isHospital ? 11 : 7,
                      height: isHospital ? 11 : 7,
                      backgroundColor: color,
                      boxShadow: `0 0 0 1.5px ${palette.surface}, 0 1px 3px rgb(0 0 0 / 0.28)`,
                    }}
                  />
                </MarkerContent>
                <MarkerTooltip className="max-w-[240px]" offset={12}>
                  <span className="block text-[11px] font-semibold leading-snug">
                    {facility.name}
                  </span>
                  <span className="mt-0.5 block text-[10px] opacity-75">
                    Cat. {facility.category} · {facility.districtName} ·{' '}
                    {facility.pressureRatio === null ? 'Sin referencia de capacidad' : `${formatPercent(facility.pressureRatio)} de carga SIS estimada`}
                  </span>
                </MarkerTooltip>
              </MapMarker>
            );
          })}

        <MapToolbar />
      </Map>

      {/* Panel de capas ------------------------------------------------- */}
      <div className="absolute left-3 top-3 z-10 w-[220px] max-w-[calc(100%-1.5rem)]">
        <div className="overflow-hidden rounded-lg border border-border bg-background/92 shadow-md backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setPanelOpen((o) => !o)}
            aria-expanded={panelOpen}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Layers className="size-3.5" />
            <span className="flex-1 text-left">Capas</span>
            <span className="text-[9px] font-normal normal-case tracking-normal">
              {panelOpen ? 'Ocultar' : 'Mostrar'}
            </span>
          </button>

          {panelOpen && (
            <div className="space-y-2.5 border-t border-border px-3 pb-3 pt-2.5">
              <div className="space-y-1">
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
                  Coropleta
                </span>
                <div className="flex rounded-md border border-border bg-surface-sunken p-0.5">
                  {(
                    [
                      { id: 'priority', label: 'Prioridad' },
                      { id: 'vulnerability', label: 'Pobreza 2018' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setLayer(opt.id)}
                      className={cn(
                        'flex-1 cursor-pointer rounded px-2 py-1 text-[10.5px] font-semibold transition-colors',
                        layer === opt.id
                          ? 'bg-surface text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-0.5 border-t border-border pt-2">
                <Checkbox
                  checked={showFacilities}
                  onChange={setShowFacilities}
                  label="Establecimientos IPRESS"
                />
                <Checkbox
                  checked={showLabels}
                  onChange={setShowLabels}
                  label="Rótulos distritales"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lectura del distrito bajo el cursor ---------------------------- */}
      {hovered && (
        <div className="pointer-events-none absolute left-3 top-3 z-20 hidden -translate-y-[calc(100%+0.5rem)] sm:block">
          <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
            <div className="text-[11px] font-semibold text-foreground">
              {hovered.name}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {layer === 'priority' ? 'Prioridad' : 'Pobreza INEI 2018'}:{' '}
              <span className="font-semibold" style={{ color: hovered.color }}>
                {formatPercent(hovered.score)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Leyenda -------------------------------------------------------- */}
      <div className="absolute bottom-3 left-3 z-10 max-w-[calc(100%-1.5rem)] rounded-lg border border-border bg-background/92 px-3 py-2.5 shadow-md backdrop-blur-sm">
        <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-subtle-foreground">
          {layer === 'priority'
            ? 'Índice de prioridad sanitaria'
            : 'Pobreza INEI 2018 (punto medio)'}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {[...RISK_SCALE].reverse().map((step) => (
            <span
              key={step.level}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
            >
              <span
                className="size-2 rounded-[2px]"
                style={{ backgroundColor: readCssColor(step.cssVar) }}
              />
              {step.level}
            </span>
          ))}
        </div>
        {showFacilities && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2">
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Building2 className="size-3" style={{ color: palette.info }} />
              Hospital II / III
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <MapPin className="size-3" style={{ color: palette.primary }} />
              Primer nivel
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: palette.negative }}
              />
              Presión SIS &gt; referencia
            </span>
          </div>
        )}
      </div>

      {/* Distintivo de escenario simulado -------------------------------- */}
      {simulationOverlay && (
        <div className="absolute bottom-9 right-3 z-10 rounded-lg border border-primary/40 bg-background/92 px-3 py-2 shadow-md backdrop-blur-sm">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-primary">
            Escenario simulado
          </div>
          <div className="mt-0.5 numeric text-[11px] text-muted-foreground">
            {formatPercent(simulationOverlay.beforePriority)}
            <span className="mx-1 text-subtle-foreground">→</span>
            <span className="font-semibold text-foreground">
              {formatPercent(simulationOverlay.afterPriority)}
            </span>
          </div>
        </div>
      )}

      {/* Resumen del distrito activo ------------------------------------ */}
      {selectedTerritory && !compact && (
        <div className="absolute right-[3.25rem] top-3 z-10 hidden w-[200px] rounded-lg border border-border bg-background/92 p-3 shadow-md backdrop-blur-sm xl:block">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-subtle-foreground">
            Distrito activo
          </div>
          <div className="mt-0.5 text-[13px] font-semibold text-foreground">
            {selectedTerritory.name}
          </div>
          <dl className="mt-2 space-y-1 border-t border-border pt-2 text-[10.5px]">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Población</dt>
              <dd className="numeric font-semibold text-foreground">
                {formatNumber(selectedTerritory.population)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Prioridad</dt>
              <dd
                className="numeric font-semibold"
                style={{
                  color: colorForScore(
                    selectedTerritory.currentState.priorityIndex,
                  ),
                }}
              >
                {formatPercent(selectedTerritory.currentState.priorityIndex)} ·{' '}
                {getRiskLevel(selectedTerritory.currentState.priorityIndex)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Acceso</dt>
              <dd className="numeric font-semibold text-foreground">
                {selectedTerritory.currentState.avgTravelTimeMinutes === null ? 'Sin dato' : `${selectedTerritory.currentState.avgTravelTimeMinutes.toFixed(1)} min aprox.`}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">IPRESS</dt>
              <dd className="numeric font-semibold text-foreground">
                {selectedTerritory.activeFacilitiesCount}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Capas de polígonos (necesitan estar dentro de <Map> para usar useMap)       */
/* -------------------------------------------------------------------------- */

const DistrictLayers: React.FC<{
  data: ReturnType<typeof buildDistrictCollection>;
  palette: Record<string, string>;
  onSelectDistrict: (id: number) => void;
  onHover: (props: DistrictFeatureProps | null) => void;
}> = ({ data, palette, onSelectDistrict, onHover }) => {
  const anchor = useLabelLayerAnchor();

  return (
    <MapGeoJSON<DistrictFeatureProps>
      id="distritos-trujillo"
      data={data}
      promoteId="id"
      interactive
      beforeId={anchor}
      fillPaint={{
        'fill-color': ['get', 'color'],
        'fill-opacity': [
          'case',
          ['==', ['get', 'selected'], 1],
          0.55,
          ['==', ['get', 'simulated'], 1],
          0.45,
          0.26,
        ],
      }}
      fillHoverPaint={{ 'fill-opacity': 0.6 }}
      linePaint={{
        'line-color': [
          'case',
          ['==', ['get', 'selected'], 1],
          palette.foreground,
          ['==', ['get', 'simulated'], 1],
          palette.primary,
          ['get', 'color'],
        ],
        'line-width': [
          'case',
          ['==', ['get', 'selected'], 1],
          2.2,
          ['==', ['get', 'simulated'], 1],
          1.8,
          0.9,
        ],
        'line-opacity': 0.9,
      }}
      onClick={(e) => onSelectDistrict(e.feature.properties.id)}
      onHover={(e) => onHover(e ? e.feature.properties : null)}
    />
  );
};

import React from 'react';
import { HealthFacility, Territory } from '../../types';
import {
  MetropolitanMap,
  type SimulationOverlay,
} from '../../components/map/MetropolitanMap';
import { ViewContainer } from '../../components/layout/AppShell';
import { Badge, PageHeader } from '../../components/ui';
import { formatNumber } from '../../lib/format';

interface MapWorkspaceProps {
  territories: Territory[];
  facilities: HealthFacility[];
  selectedDistrictId: number | null;
  onSelectDistrict: (id: number) => void;
  simulationOverlay: SimulationOverlay | null;
  currentMonthLabel: string;
}

export const MapWorkspace: React.FC<MapWorkspaceProps> = ({
  territories,
  facilities,
  selectedDistrictId,
  onSelectDistrict,
  simulationOverlay,
  currentMonthLabel,
}) => (
  <ViewContainer>
    <PageHeader
      eyebrow="Panorama"
      title="Visor cartográfico espacio-temporal"
      description="Polígonos distritales, geolocalización de IPRESS y capas de riesgo sobre el Área Metropolitana de Trujillo."
      actions={
        <>
          <Badge tone="outline" mono>
            {currentMonthLabel}
          </Badge>
          <Badge tone="outline">
            {territories.length} distritos · {formatNumber(facilities.length)} IPRESS
          </Badge>
        </>
      }
    />

    <MetropolitanMap
      territories={territories}
      facilities={facilities}
      selectedDistrictId={selectedDistrictId}
      onSelectDistrict={onSelectDistrict}
      simulationOverlay={simulationOverlay}
      className="h-[calc(100dvh-13rem)] min-h-[480px]"
    />
  </ViewContainer>
);

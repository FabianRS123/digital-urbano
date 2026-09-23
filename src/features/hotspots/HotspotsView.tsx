import React, { useState } from 'react';
import { ArrowUpRight, RotateCcw } from 'lucide-react';
import { Territory } from '../../types';
import { ViewContainer } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Callout,
  CellStack,
  Meter,
  PageHeader,
  Slider,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui';
import { formatNumber, formatPercent } from '../../lib/format';
import {
  getRiskBadgeClass,
  getRiskFillClass,
  getRiskLevel,
} from '../../lib/risk';

interface HotspotsViewProps {
  territories: Territory[];
  onSelectDistrict: (id: number) => void;
  onOpenSimulatorForDistrict: (id: number) => void;
}

const BASE_WEIGHTS = {
  vulnerability: 0.35,
  pressure: 0.25,
  access: 0.25,
  spillover: 0.15,
};

export const HotspotsView: React.FC<HotspotsViewProps> = ({
  territories,
  onSelectDistrict,
  onOpenSimulatorForDistrict,
}) => {
  const [weights, setWeights] = useState(BASE_WEIGHTS);

  const total =
    weights.vulnerability + weights.pressure + weights.access + weights.spillover;
  const isNormalized = Math.abs(total - 1) < 0.001;

  const ranked = territories
    .map((t) => {
      if (t.currentState.systemPressure === null || t.currentState.accessibilityIndex === null)
        return { territory: t, score: null as number | null };
      const pressureScore = Math.min(
        Math.max((t.currentState.systemPressure - 0.6) / 1.0, 0),
        1,
      );
      const accessDeficit = Math.max(1 - t.currentState.accessibilityIndex, 0);
      const raw =
        t.sdoh.vulnerabilityIndex * weights.vulnerability +
        pressureScore * weights.pressure +
        accessDeficit * weights.access +
        t.currentState.contagionRisk * 0.8 * weights.spillover;
      // Se normaliza por la suma de pesos para que el índice siga siendo
      // comparable cuando el usuario altera la calibración.
      const score =
        Math.round(Math.min(Math.max(raw / (total || 1), 0.05), 0.98) * 100) /
        100;
      return { territory: t, score: score as number | null };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  const setWeight = (key: keyof typeof BASE_WEIGHTS, value: number) =>
    setWeights((prev) => ({ ...prev, [key]: value }));

  return (
    <ViewContainer>
      <PageHeader
        eyebrow="Analítica"
        title="Hotspots y priorización territorial"
        description="Índice transparente y reproducible para ordenar las intervenciones sociosanitarias en la escala 0.00 – 1.00."
        actions={
          <Badge tone="outline">Fórmula auditable y reproducible</Badge>
        }
      />

      {/* Calibración ----------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle hint="Ajusta los pesos para evaluar la sensibilidad del ordenamiento">
            Calibración de ponderaciones
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={() => setWeights(BASE_WEIGHTS)}>
            <RotateCcw className="size-3.5" />
            Restablecer
          </Button>
        </CardHeader>

        <CardBody className="space-y-4 pt-4">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Slider
              label="Pobreza INEI 2018"
              value={weights.vulnerability}
              displayValue={`${(weights.vulnerability * 100).toFixed(0)} %`}
              hint="Pobreza, agua y saneamiento"
              min={0.1}
              max={0.6}
              step={0.05}
              onChange={(v) => setWeight('vulnerability', v)}
            />
            <Slider
              label="Presión asistencial"
              value={weights.pressure}
              displayValue={`${(weights.pressure * 100).toFixed(0)} %`}
              hint="Demanda sobre capacidad instalada"
              min={0.1}
              max={0.5}
              step={0.05}
              onChange={(v) => setWeight('pressure', v)}
            />
            <Slider
              label="Déficit de acceso"
              value={weights.access}
              displayValue={`${(weights.access * 100).toFixed(0)} %`}
              hint="Conectividad y tiempo de viaje"
              min={0.1}
              max={0.5}
              step={0.05}
              onChange={(v) => setWeight('access', v)}
            />
            <Slider
              label="Spillover vecinal"
              value={weights.spillover}
              displayValue={`${(weights.spillover * 100).toFixed(0)} %`}
              hint="Presión cruzada de distritos colindantes"
              min={0.05}
              max={0.3}
              step={0.05}
              onChange={(v) => setWeight('spillover', v)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-sunken/70 px-3.5 py-3">
            <code className="font-mono text-[11px] text-foreground">
              Prioridad = ({weights.vulnerability.toFixed(2)} × Pobreza) + (
              {weights.pressure.toFixed(2)} × Presión) + (
              {weights.access.toFixed(2)} × DéficitAcceso) + (
              {weights.spillover.toFixed(2)} × Spillover)
            </code>
            <Badge tone={isNormalized ? 'positive' : 'warning'} mono>
              Σ pesos = {(total * 100).toFixed(0)} %
            </Badge>
          </div>

          {!isNormalized && (
            <Callout tone="warning">
              La suma de pesos difiere de 100 %. El índice se normaliza dividiendo
              entre {(total).toFixed(2)} para que el ranking siga siendo
              comparable con la calibración base.
            </Callout>
          )}
        </CardBody>
      </Card>

      {/* Ranking --------------------------------------------------------- */}
      <Card flush>
        <CardHeader>
          <CardTitle hint={`${ranked.length} distritos evaluados`}>
            Orden de prioridad para asignación de recursos
          </CardTitle>
        </CardHeader>

        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th align="center" className="w-12">
                  #
                </Th>
                <Th>Distrito</Th>
                <Th>Pobreza INEI 2018</Th>
                <Th>Demanda / capacidad</Th>
                <Th>Tiempo de viaje</Th>
                <Th align="right">Índice</Th>
                <Th align="center">Nivel</Th>
                <Th align="right">Acción</Th>
              </tr>
            </Thead>
            <Tbody>
              {ranked.map(({ territory, score }, idx) => (
                <Tr
                  key={territory.id}
                  interactive
                  onClick={() => onSelectDistrict(territory.id)}
                >
                  <Td align="center" className="font-mono text-subtle-foreground">
                    {String(idx + 1).padStart(2, '0')}
                  </Td>
                  <Td>
                    <CellStack
                      primary={territory.name}
                      secondary={`${formatNumber(territory.population)} hab · ${territory.activeFacilitiesCount} IPRESS`}
                    />
                  </Td>
                  <Td>
                    <CellStack
                      primary={formatPercent(territory.sdoh.vulnerabilityIndex)}
                      secondary={`Quintil ${territory.sdoh.vulnerabilityQuintile}`}
                    />
                  </Td>
                  <Td>
                    <CellStack
                      primary={formatPercent(territory.currentState.systemPressure)}
                      secondary={`${formatNumber(territory.currentState.historicalDemand)} / ${formatNumber(territory.currentState.healthcareCapacity)}`}
                    />
                  </Td>
                  <Td>
                    <CellStack
                      primary={territory.currentState.avgTravelTimeMinutes === null ? 'Sin dato' : `${territory.currentState.avgTravelTimeMinutes.toFixed(1)} min aprox.`}
                      secondary={`${formatPercent(territory.currentState.accessibilityIndex)} de acceso`}
                    />
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-2">
                      <Meter
                        value={score ?? 0}
                        barClassName={getRiskFillClass(score)}
                        className="h-1 w-14"
                      />
                      <span className="numeric font-mono text-[12.5px] font-semibold text-foreground">
                        {formatPercent(score)}
                      </span>
                    </div>
                  </Td>
                  <Td align="center">
                    <Badge className={getRiskBadgeClass(score)}>
                      {getRiskLevel(score)}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSimulatorForDistrict(territory.id);
                      }}
                    >
                      Simular
                      <ArrowUpRight className="size-3.5" />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      </Card>
    </ViewContainer>
  );
};

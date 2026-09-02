import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Territory } from '../../types';
import { getRiskFactorsExplanation } from '../../lib/spatiotemporalGnn';
import { ViewContainer } from '../../components/layout/AppShell';
import {
  Badge,
  Callout,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Meter,
  PageHeader,
  Pill,
  Select,
} from '../../components/ui';
import { formatPercent } from '../../lib/format';
import { getRiskBadgeClass, getRiskLevel } from '../../lib/risk';

interface RiskExplainabilityViewProps {
  territories: Territory[];
  selectedDistrictId: number;
  onSelectDistrict: (id: number) => void;
}

export const RiskExplainabilityView: React.FC<RiskExplainabilityViewProps> = ({
  territories,
  selectedDistrictId,
  onSelectDistrict,
}) => {
  const district =
    territories.find((t) => t.id === selectedDistrictId) ?? territories[0];
  const factors = getRiskFactorsExplanation(district);
  const maxWeight = Math.max(...factors.map((f) => f.weight));
  const score = district.currentState.priorityIndex;

  return (
    <ViewContainer>
      <PageHeader
        eyebrow="Analítica"
        title="Explicabilidad del riesgo"
        description={`Descomposición interpretable (estilo SHAP) del índice de prioridad para ${district.name}.`}
        actions={
          <>
            <Badge className={getRiskBadgeClass(score)} mono>
              {formatPercent(score)} · {getRiskLevel(score)}
            </Badge>
            <div className="w-[200px]">
              <Select
                value={district.id}
                onChange={(e) => onSelectDistrict(parseInt(e.target.value, 10))}
                aria-label="Territorio"
              >
                {territories.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
          </>
        }
      />

      <Callout
        tone="warning"
        icon={<ShieldAlert className="size-5" />}
        title="Advertencia ética y epidemiológica de no causalidad"
      >
        Los factores de ponderación e importancia de variables reflejan{' '}
        <strong className="font-semibold text-foreground">
          asociaciones estadísticas y correlaciones espacio-temporales
        </strong>{' '}
        capturadas por la red neuronal en grafos. No demuestran una relación
        causal biológica o sociológica determinista y deben interpretarse junto
        con la experiencia clínica y de salud pública en campo.
      </Callout>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {factors.map((factor) => (
          <Card key={factor.factor}>
            <CardHeader>
              <CardTitle hint={<Pill>{factor.category}</Pill>}>
                {factor.factor}
              </CardTitle>
              <Badge
                tone={
                  factor.impact.includes('Alto')
                    ? 'negative'
                    : factor.impact.includes('Moderado')
                      ? 'warning'
                      : 'positive'
                }
              >
                {factor.impact}
              </Badge>
            </CardHeader>
            <CardBody className="space-y-3.5 pt-4">
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                {factor.description}
              </p>

              <div className="space-y-1.5 border-t border-border pt-3">
                <div className="flex items-baseline justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    Ponderación en el índice
                  </span>
                  <span className="numeric font-semibold text-primary">
                    {formatPercent(factor.weight)}
                  </span>
                </div>
                <Meter value={factor.weight / maxWeight} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    Puntuación del factor en {district.name}
                  </span>
                  <span className="numeric font-semibold text-foreground">
                    {formatPercent(factor.score)}
                  </span>
                </div>
                <Meter
                  value={factor.score}
                  barClassName={
                    factor.score > 0.66
                      ? 'bg-risk-critical'
                      : factor.score > 0.4
                        ? 'bg-risk-medium'
                        : 'bg-risk-low'
                  }
                />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </ViewContainer>
  );
};

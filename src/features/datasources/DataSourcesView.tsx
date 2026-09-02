import React, { useState } from 'react';
import { Check, RefreshCw, ShieldCheck } from 'lucide-react';
import { DATA_SOURCES } from '../../data/trujilloData';
import { ViewContainer } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageHeader,
  Pill,
} from '../../components/ui';
import { formatNumber } from '../../lib/format';
import { cn } from '../../lib/utils';

export const DataSourcesView: React.FC = () => {
  const [sources, setSources] = useState(DATA_SOURCES);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const totalRecords = sources.reduce((s, item) => s + item.recordsCount, 0);

  const handleTriggerSync = () => {
    setIsSyncing(true);
    setToast(null);

    window.setTimeout(() => {
      const stamp = new Date().toLocaleDateString('es-PE');
      setSources((prev) =>
        prev.map((s) => ({
          ...s,
          lastSync: `Hoy · ${stamp}`,
          status: 'Sincronizado',
        })),
      );
      setIsSyncing(false);
      setToast(
        `Pipeline ETL ejecutado. Se validaron ${formatNumber(totalRecords)} registros metropolitanos.`,
      );
      window.setTimeout(() => setToast(null), 4500);
    }, 1200);
  };

  return (
    <ViewContainer>
      <PageHeader
        eyebrow="Gobernanza"
        title="Fuentes de datos y pipeline de ingesta"
        description="Monitoreo y gobernanza de los datos oficiales de salud pública, censos y capas geográficas que alimentan el gemelo digital."
        actions={
          <>
            <Badge tone="outline" mono>
              {formatNumber(totalRecords)} registros
            </Badge>
            <Button
              variant="primary"
              onClick={handleTriggerSync}
              disabled={isSyncing}
            >
              <RefreshCw
                className={cn('size-3.5', isSyncing && 'animate-spin')}
              />
              {isSyncing ? 'Ejecutando ingesta…' : 'Ejecutar sincronización'}
            </Button>
          </>
        }
      />

      {toast && (
        <Callout
          tone="info"
          icon={<Check className="size-4" />}
          className="animate-fade-rise"
        >
          {toast}
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sources.map((source) => (
          <Card key={source.id}>
            <CardHeader>
              <CardTitle hint={source.institution}>{source.name}</CardTitle>
              <Badge
                tone={source.status === 'Sincronizado' ? 'positive' : 'warning'}
                dot
              >
                {source.status}
              </Badge>
            </CardHeader>
            <CardBody className="space-y-3 pt-4">
              <div className="flex flex-wrap gap-1.5">
                <Pill>{source.id.toUpperCase()}</Pill>
                {source.sourceType && <Pill>{source.sourceType}</Pill>}
              </div>

              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                {source.description}
              </p>

              <dl className="grid grid-cols-3 gap-3 border-t border-border pt-3 text-[10.5px]">
                <div>
                  <dt className="text-subtle-foreground">Registros</dt>
                  <dd className="numeric mt-0.5 font-mono font-semibold text-foreground">
                    {formatNumber(source.recordsCount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle-foreground">Frecuencia</dt>
                  <dd className="mt-0.5 font-semibold text-foreground">
                    {source.updateFrequency ?? source.frequency ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle-foreground">Última sinc.</dt>
                  <dd className="mt-0.5 font-semibold text-primary">
                    {source.lastSync ?? source.lastUpdated ?? '—'}
                  </dd>
                </div>
              </dl>

              {(source.coverageTemporal || source.coverageSpatial) && (
                <div className="text-[10px] text-subtle-foreground">
                  Cobertura: {source.coverageTemporal ?? '—'} ·{' '}
                  {source.coverageSpatial ?? '—'}
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      <Callout
        icon={<ShieldCheck className="size-4" />}
        title="Gobernanza de datos y anonimización"
      >
        Todos los datos de consultas y atenciones ambulatorias se agregan a
        nivel distrital y sectorial para garantizar la anonimización total
        conforme a la Ley N.° 29733 de Protección de Datos Personales del Perú.
        Los registros no contienen información personal identificable (PII).
      </Callout>
    </ViewContainer>
  );
};

import React, { useEffect, useState } from 'react';
import { Check, RefreshCw, ShieldCheck } from 'lucide-react';
import type { DataSourceItem } from '../../types';
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

export const DataSourcesView: React.FC<{ sources: DataSourceItem[]; version: string; createdAt: string; checkedAt: string; onUpdated: () => Promise<void> }> = ({ sources, version, createdAt, checkedAt, onUpdated }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const totalRecords = sources.reduce((s, item) => s + item.recordsCount, 0);

  useEffect(() => {
    void fetch('/api/v1/data-sources/sync').then((res) => res.json()).then((status) => {
      setIsSyncing(status.status === 'running');
      if (status.error) setToast(`${status.progress}: ${status.error}`);
      else if (status.status === 'running') setToast(status.progress);
    }).catch((error) => setToast(String(error)));
  }, []);

  const handleTriggerSync = async () => {
    setToast(null);
    const res = await fetch('/api/v1/data-sources/sync', { method: 'POST' });
    if (!res.ok && res.status !== 409) { setToast(`No se pudo iniciar la descarga: HTTP ${res.status}`); return; }
    setIsSyncing(true);
  };

  useEffect(() => {
    if (!isSyncing) return;
    const timer = window.setInterval(async () => {
      try {
        const status = await (await fetch('/api/v1/data-sources/sync')).json();
        setToast(status.progress);
        if (status.status !== 'running') {
          setIsSyncing(false);
          if (status.status === 'success') await onUpdated();
          if (status.error) setToast(`${status.progress}: ${status.error}`);
        }
      } catch (error) { setIsSyncing(false); setToast(String(error)); }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [isSyncing, onUpdated]);

  return (
    <ViewContainer>
      <PageHeader
        eyebrow="Gobernanza"
        title="Fuentes de datos y pipeline de ingesta"
        description="Fuentes oficiales descargadas por el servidor. Cada periodo y fecha corresponden a su fuente original."
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
                {isSyncing ? 'Descargando y procesando…' : 'Ejecutar sincronización'}
            </Button>
          </>
        }
      />

      <p className="text-xs text-muted-foreground">Versión {version} · publicada {new Date(createdAt).toLocaleString('es-PE')} · última comprobación {new Date(checkedAt).toLocaleString('es-PE')}</p>

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
                {source.description ?? `${source.institution ?? ''} · datos oficiales`}
              </p>
              <div className="flex flex-wrap gap-3 text-[11px] text-primary underline">
                {source.pageUrl && <a href={source.pageUrl} target="_blank" rel="noopener noreferrer">Página oficial</a>}
                {(source.resourceUrls ?? (source.resourceUrl ? [source.resourceUrl] : [])).map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">Descarga original {source.id === 'sis' ? index + 1 : ''}</a>)}
              </div>

              <dl className="grid grid-cols-3 gap-3 border-t border-border pt-3 text-[10.5px]">
                <div>
                  <dt className="text-subtle-foreground">Registros</dt>
                  <dd className="numeric mt-0.5 font-mono font-semibold text-foreground">
                    {formatNumber(source.recordsCount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle-foreground">Periodo</dt>
                  <dd className="mt-0.5 font-semibold text-foreground">
                    {source.period ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle-foreground">Última sinc.</dt>
                  <dd className="mt-0.5 font-semibold text-primary">
                    {source.fetchedAt ? new Date(source.fetchedAt).toLocaleString('es-PE') : '—'}
                  </dd>
                </div>
              </dl>

              <div className="text-[10px] text-subtle-foreground">Registros rechazados: {source.rejectedCount ?? 0}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Callout
        icon={<ShieldCheck className="size-4" />}
        title="Gobernanza de datos y anonimización"
      >
        La aplicación conserva únicamente agregados de consultas externas SIS por
        mes, distrito e IPRESS. Capacidad, accesibilidad y escenarios son
        estimaciones con métodos documentados; los periodos de las fuentes difieren.
      </Callout>
    </ViewContainer>
  );
};

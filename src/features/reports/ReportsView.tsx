import React, { useState } from 'react';
import { FileSpreadsheet, Printer } from 'lucide-react';
import type { DataSourceItem, HealthFacility, SimulationResult, Territory } from '../../types';
import { DictamenReport } from '../dictamen/DictamenReport';
import { useDictamen } from '../dictamen/useDictamen';
import { ViewContainer } from '../../components/layout/AppShell';
import { Button, Card, CardBody, PageHeader, Select, Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '../../components/ui';
import { formatNumber, formatPercent } from '../../lib/format';

interface ReportsViewProps {
  territories: Territory[];
  facilities: HealthFacility[];
  latestSimulation: SimulationResult | null;
  sources: DataSourceItem[];
  datasetVersion: string;
  monthKey: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ territories, facilities, latestSimulation, sources, datasetVersion, monthKey }) => {
  const [districtId, setDistrictId] = useState(territories[0]?.id ?? 1);
  const district = territories.find((item) => item.id === districtId) ?? territories[0];
  const { dictamen, loading, error, generar } = useDictamen();
  const rows = [...territories].sort((a, b) => (b.currentState.priorityIndex ?? -1) - (a.currentState.priorityIndex ?? -1));
  const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const exportCsv = () => {
    const sourceKeys = ['renipress', 'sis', 'population', 'poverty', 'boundaries'];
    const sourceColumns = sourceKeys.flatMap((key) => [`${key}_period`, `${key}_page`, `${key}_resources`]);
    const sourceValues = sourceKeys.flatMap((key) => { const source = sources.find((item) => item.id === key);
      return [source?.period ?? '', source?.pageUrl ?? '', (source?.resourceUrls ?? (source?.resourceUrl ? [source.resourceUrl] : [])).join(' | ')]; });
    const table = [
      ['dataset_version', 'mes_sis', 'ubigeo', 'distrito', 'poblacion', 'pobreza_2018_limite_inferior_pct', 'pobreza_2018_limite_superior_pct', 'pobreza_2018_punto_medio', 'consultas_externas_sis', 'capacidad_estimada', 'presion_estimada', 'accesibilidad_estimada', 'prioridad_derivada', ...sourceColumns],
      ...territories.map((item) => [datasetVersion, monthKey, item.code, item.name, item.population, item.povertyInterval?.[0], item.povertyInterval?.[1], item.sdoh.povertyRate, item.currentState.historicalDemand, item.currentState.healthcareCapacity, item.currentState.systemPressure, item.currentState.accessibilityIndex, item.currentState.priorityIndex, ...sourceValues]),
    ];
    const blob = new Blob(['\uFEFF', table.map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `GDUS_${monthKey}_${datasetVersion}.csv`; link.click();
    URL.revokeObjectURL(url);
  };
  return <ViewContainer>
    <PageHeader eyebrow="Gobernanza" title="Reportes y dictámenes" description="Consultas externas SIS y estimaciones explícitas para diez distritos de Trujillo." actions={<><Button onClick={() => window.print()}><Printer className="size-3.5" />Imprimir / PDF</Button><Button onClick={exportCsv}><FileSpreadsheet className="size-3.5" />Exportar CSV</Button></>} />
    <Card className="printable-area"><CardBody className="space-y-6 p-6">
      <header><h3 className="text-lg font-semibold">Gemelo Digital Urbano de Salud · Trujillo</h3><p className="text-sm text-muted-foreground">Mes SIS: {monthKey} · Versión: {datasetVersion} · {new Date().toLocaleDateString('es-PE')}</p></header>
      <p className="text-sm">Población: {formatNumber(territories.reduce((sum, item) => sum + item.population, 0))} · Consultas externas SIS del mes: {territories.every((item) => item.currentState.historicalDemand !== null) ? formatNumber(territories.reduce((sum, item) => sum + item.currentState.historicalDemand!, 0)) : 'Sin dato completo'} · IPRESS RENIPRESS: {formatNumber(facilities.length)}.</p>
      <p className="text-xs text-muted-foreground">Población INEI {monthKey.slice(0, 4)}; pobreza INEI 2018. Capacidad (percentil 95 de consultas SIS), accesibilidad geográfica y prioridad son estimaciones. Los efectos de intervenciones son hipótesis del simulador. Simbal y Alto Trujillo están excluidos de la muestra.</p>
      <TableWrap><Table><Thead><tr><Th>Distrito</Th><Th>UBIGEO</Th><Th align="right">Consultas SIS</Th><Th align="right">Prioridad</Th></tr></Thead><Tbody>{rows.map((item) => <Tr key={item.id}><Td>{item.name}</Td><Td>{item.code}</Td><Td align="right">{formatNumber(item.currentState.historicalDemand)}</Td><Td align="right">{item.currentState.priorityIndex === null ? 'Sin dato' : formatPercent(item.currentState.priorityIndex)}</Td></Tr>)}</Tbody></Table></TableWrap>
      {latestSimulation && <p className="text-sm">Escenario hipotético: {latestSimulation.scenarioName}. {latestSimulation.verdict}</p>}
      <section className="space-y-2"><h4 className="font-semibold">Dictamen distrital</h4><Select value={district.id} onChange={(event) => setDistrictId(Number(event.target.value))}>{territories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Button disabled={loading} onClick={() => generar(district.id, 'Investigador', datasetVersion, monthKey)}>{loading ? 'Generando…' : 'Generar dictamen'}</Button>{error && <p className="text-negative">{error}</p>}{dictamen?.distrito.id === district.id && dictamen.periodo === monthKey && dictamen.datasetVersion === datasetVersion && <DictamenReport dictamen={dictamen} />}</section>
      <section className="space-y-2"><h4 className="font-semibold">Fuentes oficiales y recursos</h4>{sources.map((source) => <p className="text-xs" key={source.id}>{source.name} · {source.period} · <a className="underline" href={source.pageUrl} target="_blank" rel="noreferrer">Página</a> · {(source.resourceUrls ?? [source.resourceUrl]).map((url, index) => <React.Fragment key={url}><a className="underline" href={url} target="_blank" rel="noreferrer">Recurso {index + 1}</a>{' '}</React.Fragment>)}</p>)}</section>
    </CardBody></Card>
  </ViewContainer>;
};

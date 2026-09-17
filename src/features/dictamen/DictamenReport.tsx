import React, { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { DictamenTecnico, EstadoIndicador } from '../../types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Meter,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui';
import { formatNumber, formatPercent } from '../../lib/format';
import { getRiskBadgeClass } from '../../lib/risk';
import { cn } from '../../lib/utils';

const ESTADO: Record<EstadoIndicador, { label: string; tone: 'negative' | 'warning' | 'positive' }> = {
  critico: { label: 'Crítico', tone: 'negative' },
  alerta: { label: 'Alerta', tone: 'warning' },
  adecuado: { label: 'Adecuado', tone: 'positive' },
};

const SEVERIDAD = {
  alta: { label: 'Alta', bar: 'bg-negative', tone: 'negative' as const },
  media: { label: 'Media', bar: 'bg-warning', tone: 'warning' as const },
  baja: { label: 'Baja', bar: 'bg-positive', tone: 'positive' as const },
};

/** Informe técnico estructurado, con exportación a PDF. */
export const DictamenReport: React.FC<{ dictamen: DictamenTecnico }> = ({ dictamen: d }) => {
  const [exportando, setExportando] = useState(false);

  const descargarPdf = async () => {
    setExportando(true);
    try {
      // Carga diferida: jsPDF solo se descarga cuando alguien exporta.
      const { exportDictamenPdf } = await import('./exportDictamenPdf');
      exportDictamenPdf(d);
    } finally {
      setExportando(false);
    }
  };

  const grupos = [...new Set(d.indicadores.map((i) => i.grupo))];
  const criticos = d.indicadores.filter((i) => i.estado === 'critico').length;

  return (
    <Card className="animate-fade-rise overflow-hidden">
      {/* Encabezado del documento --------------------------------------- */}
      <div className="border-b border-border bg-primary px-5 py-5 text-primary-foreground sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">
              Dictamen técnico epidemiológico
            </div>
            <h3 className="mt-1 text-[20px] font-semibold leading-tight tracking-tight">
              Distrito de {d.distrito.nombre}
            </h3>
            <div className="mt-1.5 font-mono text-[11px] opacity-80">{d.codigo}</div>
          </div>
          <Button
            onClick={descargarPdf}
            disabled={exportando}
            className="border-primary-foreground/30 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
          >
            <Download className="size-3.5" />
            {exportando ? 'Generando PDF…' : 'Descargar PDF'}
          </Button>
        </div>
      </div>

      <CardBody className="space-y-7 p-5 sm:p-6">
        {/* Ficha ---------------------------------------------------------- */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[11.5px] sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['UBIGEO', d.distrito.ubigeo],
            ['Población', `${formatNumber(d.distrito.poblacion)} hab.`],
            ['Periodo', d.periodo],
            ['Ranking', `${d.clasificacion.rankingMetropolitano} de ${d.clasificacion.totalDistritos}`],
            ['Vulnerabilidad', `Quintil ${d.clasificacion.quintil}`],
            ['Emisión', new Date(d.fechaEmision).toLocaleDateString('es-PE', { dateStyle: 'medium' })],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{k}</dt>
              <dd className="numeric mt-0.5 font-semibold text-foreground">{v}</dd>
            </div>
          ))}
        </dl>

        {/* 1. Resumen ------------------------------------------------------ */}
        <Section numero={1} titulo="Resumen ejecutivo">
          <div className="flex flex-wrap items-center gap-2 pb-3">
            <Badge className={getRiskBadgeClass(d.clasificacion.prioridad)} mono>
              Prioridad {formatPercent(d.clasificacion.prioridad)} · {d.clasificacion.categoria}
            </Badge>
            <Badge tone={criticos ? 'negative' : 'positive'}>
              {criticos} de {d.indicadores.length} indicadores críticos
            </Badge>
          </div>
          <p className="max-w-[80ch] text-[13px] leading-relaxed text-foreground">
            {d.narrativa.resumenEjecutivo}
          </p>
        </Section>

        {/* 2. Indicadores -------------------------------------------------- */}
        <Section numero={2} titulo="Indicadores del gemelo digital" flush>
          <TableWrap className="rounded-lg border border-border">
            <Table>
              <Thead>
                <tr>
                  <Th>Indicador</Th>
                  <Th align="right">Valor</Th>
                  <Th>Referencia</Th>
                  <Th align="center">Estado</Th>
                </tr>
              </Thead>
              <Tbody>
                {grupos.map((grupo) => (
                  <React.Fragment key={grupo}>
                    <tr className="bg-muted/50">
                      <td
                        colSpan={4}
                        className="px-5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                      >
                        {grupo}
                      </td>
                    </tr>
                    {d.indicadores
                      .filter((i) => i.grupo === grupo)
                      .map((i) => (
                        <Tr key={i.indicador}>
                          <Td>{i.indicador}</Td>
                          <Td align="right" className="numeric font-semibold">{i.valor}</Td>
                          <Td className="text-muted-foreground">{i.referencia}</Td>
                          <Td align="center">
                            <Badge tone={ESTADO[i.estado].tone} dot>
                              {ESTADO[i.estado].label}
                            </Badge>
                          </Td>
                        </Tr>
                      ))}
                  </React.Fragment>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </Section>

        {/* 3. Hallazgos ---------------------------------------------------- */}
        <Section numero={3} titulo="Hallazgos principales">
          <ul className="space-y-2.5">
            {d.narrativa.hallazgos.map((h) => (
              <li
                key={h.titulo}
                className="relative overflow-hidden rounded-lg border border-border bg-surface-sunken/50 py-3 pl-5 pr-4"
              >
                <span className={cn('absolute inset-y-0 left-0 w-1', SEVERIDAD[h.severidad].bar)} />
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="text-[12.5px] font-semibold text-foreground">{h.titulo}</span>
                  <Badge tone={SEVERIDAD[h.severidad].tone}>Severidad {SEVERIDAD[h.severidad].label.toLowerCase()}</Badge>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{h.detalle}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* 4. Factores ----------------------------------------------------- */}
        <Section numero={4} titulo="Descomposición del riesgo territorial" flush>
          <TableWrap className="rounded-lg border border-border">
            <Table>
              <Thead>
                <tr>
                  <Th>Factor</Th>
                  <Th>Dimensión</Th>
                  <Th align="right">Peso</Th>
                  <Th>Puntuación</Th>
                  <Th>Impacto</Th>
                </tr>
              </Thead>
              <Tbody>
                {d.factoresRiesgo.map((f) => (
                  <Tr key={f.factor}>
                    <Td className="font-medium">{f.factor}</Td>
                    <Td className="text-muted-foreground">{f.categoria}</Td>
                    <Td align="right" className="numeric">{formatPercent(f.peso)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Meter
                          value={f.puntuacion}
                          className="h-1 w-16"
                          barClassName={f.puntuacion > 0.66 ? 'bg-negative' : f.puntuacion > 0.4 ? 'bg-warning' : 'bg-positive'}
                        />
                        <span className="numeric font-semibold">{formatPercent(f.puntuacion)}</span>
                      </div>
                    </Td>
                    <Td className="text-muted-foreground">{f.impacto}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </Section>

        {/* 5. IPRESS ------------------------------------------------------- */}
        <Section numero={5} titulo="Oferta de servicios de salud (IPRESS)" flush>
          <TableWrap className="rounded-lg border border-border">
            <Table>
              <Thead>
                <tr>
                  <Th>Establecimiento</Th>
                  <Th align="center">Cat.</Th>
                  <Th>Estado</Th>
                  <Th align="right">Capacidad</Th>
                  <Th align="right">Demanda</Th>
                  <Th align="right">Carga</Th>
                </tr>
              </Thead>
              <Tbody>
                {d.ipress.map((f) => (
                  <Tr key={f.nombre}>
                    <Td className="font-medium">{f.nombre}</Td>
                    <Td align="center" className="font-mono text-[11px]">{f.categoria}</Td>
                    <Td className="text-muted-foreground">{f.estado} · {f.horario}</Td>
                    <Td align="right" className="numeric">{formatNumber(f.capacidad)}</Td>
                    <Td align="right" className="numeric">{formatNumber(f.demanda)}</Td>
                    <Td align="right" className={cn('numeric font-semibold', f.carga > 1 ? 'text-negative' : 'text-positive')}>
                      {formatPercent(f.carga)}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </Section>

        {/* 6. Recomendaciones ---------------------------------------------- */}
        <Section numero={6} titulo="Recomendaciones priorizadas">
          <ol className="space-y-2.5">
            {d.narrativa.recomendaciones.map((r) => (
              <li key={r.prioridad} className="grid grid-cols-[2rem_1fr] gap-3 rounded-lg border border-border p-3.5">
                <span className="flex size-7 items-center justify-center rounded-md bg-primary font-mono text-[12px] font-bold text-primary-foreground">
                  {r.prioridad}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-semibold text-foreground">{r.accion}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone="primary">{r.tipo}</Badge>
                    <Badge tone="outline">{r.plazo}</Badge>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{r.justificacion}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* 7. Red ---------------------------------------------------------- */}
        <Section numero={7} titulo="Efecto esperado en la red metropolitana">
          <p className="max-w-[80ch] text-[12.5px] leading-relaxed text-foreground">{d.narrativa.efectoRed}</p>
          {d.vecinos.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {d.vecinos.map((v) => (
                <div key={v.nombre} className="rounded-lg border border-border bg-surface-sunken/50 px-3 py-2.5">
                  <div className="text-[12px] font-semibold text-foreground">{v.nombre}</div>
                  <div className="numeric mt-0.5 text-[10.5px] text-muted-foreground">
                    Prioridad {formatPercent(v.prioridad)} · presión {formatPercent(v.presion)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 8. Limitaciones y ética ----------------------------------------- */}
        <Section numero={8} titulo="Limitaciones y cláusula ética">
          <ul className="list-disc space-y-1.5 pl-5 text-[12px] leading-relaxed text-muted-foreground">
            {d.narrativa.limitaciones.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className="mt-3 rounded-lg border border-border bg-muted/50 p-3 text-[11.5px] italic leading-relaxed text-muted-foreground">
            {d.notaEtica}
          </p>
        </Section>

        {/* Trazabilidad ---------------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-4 text-[10.5px] text-subtle-foreground">
          <span className="flex items-center gap-1.5">
            <FileText className="size-3" />
            Cifras: {d.fuente.motor}
          </span>
          <span>
            Redacción:{' '}
            {d.fuente.origen === 'langchain-agent'
              ? `agente LangChain · ${d.fuente.modelo}`
              : `${d.fuente.modelo} (agente IA no disponible)`}
          </span>
        </div>
      </CardBody>
    </Card>
  );
};

const Section: React.FC<{
  numero: number;
  titulo: string;
  flush?: boolean;
  children: React.ReactNode;
}> = ({ numero, titulo, children }) => (
  <section>
    <h4 className="mb-3 flex items-baseline gap-2 border-l-2 border-primary pl-3 text-[12px] font-semibold uppercase tracking-wide text-foreground">
      <span className="font-mono text-[11px] text-primary">{numero}.</span>
      {titulo}
    </h4>
    {children}
  </section>
);


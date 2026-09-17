import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { DictamenTecnico, EstadoIndicador } from '../../types';

/* -------------------------------------------------------------------------- */
/* Identidad del documento — paleta del gemelo, en RGB                          */
/* -------------------------------------------------------------------------- */

type RGB = [number, number, number];

const C = {
  pine: [81, 118, 100] as RGB,
  pineDark: [61, 91, 76] as RGB,
  ink: [45, 51, 25] as RGB,
  muted: [104, 104, 104] as RGB,
  line: [217, 222, 219] as RGB,
  wash: [236, 242, 240] as RGB,
  critico: [158, 74, 60] as RGB,
  alerta: [168, 135, 63] as RGB,
  adecuado: [81, 118, 100] as RGB,
};

const ESTADO_LABEL: Record<EstadoIndicador, string> = {
  critico: 'Crítico',
  alerta: 'Alerta',
  adecuado: 'Adecuado',
};

const SEVERIDAD_COLOR: Record<string, RGB> = {
  alta: C.critico,
  media: C.alerta,
  baja: C.adecuado,
};

const PAGE = { w: 210, h: 297, mx: 16, top: 24, bottom: 20 };

/**
 * Las fuentes estándar de PDF solo cubren Latin-1 (WinAnsi). Los acentos y la ñ
 * funcionan, pero flechas, signos matemáticos y espacios especiales se
 * imprimirían como basura; se normalizan antes de escribir.
 */
function t(text: string | number): string {
  return String(text)
    .replace(/→/g, '->')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/−/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/[^\x00-\xFF–—‘’“”•…]/g, '');
}

const pct = (v: number) => `${(v * 100).toFixed(0)} %`;
const num = (v: number) => v.toLocaleString('es-PE');

export function exportDictamenPdf(d: DictamenTecnico) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const contentW = PAGE.w - PAGE.mx * 2;
  let y = 0;

  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE.h - PAGE.bottom) {
      doc.addPage();
      y = PAGE.top;
    }
  };

  const sectionTitle = (numero: number, titulo: string) => {
    // Reserva título + cabecera + un par de filas: un título solo al pie de
    // página, con su contenido en la siguiente, resta credibilidad al documento.
    ensureSpace(34);
    y += 5;
    doc.setFillColor(...C.pine);
    doc.rect(PAGE.mx, y - 3.6, 1.2, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...C.ink);
    doc.text(t(`${numero}. ${titulo.toUpperCase()}`), PAGE.mx + 3.5, y);
    y += 5;
  };

  const paragraph = (text: string, size = 9.5) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...C.ink);
    const lines = doc.splitTextToSize(t(text), contentW);
    const lineH = size * 0.45;
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, PAGE.mx, y);
      y += lineH;
    }
    y += 2;
  };

  const tableBase = {
    theme: 'grid' as const,
    margin: { left: PAGE.mx, right: PAGE.mx, top: PAGE.top, bottom: PAGE.bottom },
    styles: {
      font: 'helvetica',
      fontSize: 8.2,
      cellPadding: 1.8,
      textColor: C.ink,
      lineColor: C.line,
      lineWidth: 0.2,
      valign: 'middle' as const,
    },
    headStyles: {
      fillColor: C.pine,
      textColor: [255, 255, 255] as RGB,
      fontStyle: 'bold' as const,
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 249] as RGB },
  };

  /* ------------------------------------------------------------------------ */
  /* Portada: banda de identidad + ficha                                        */
  /* ------------------------------------------------------------------------ */

  doc.setFillColor(...C.pine);
  doc.rect(0, 0, PAGE.w, 34, 'F');
  doc.setFillColor(...C.pineDark);
  doc.rect(0, 34, PAGE.w, 1.4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(t('GEMELO DIGITAL URBANO DE SALUD · ÁREA METROPOLITANA DE TRUJILLO'), PAGE.mx, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(t('Dictamen Técnico Epidemiológico'), PAGE.mx, 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text(t(`Distrito de ${d.distrito.nombre}`), PAGE.mx, 28.5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.text(t(d.codigo), PAGE.w - PAGE.mx, 11, { align: 'right' });

  // Sello de clasificación
  const sello = d.clasificacion.categoria.toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const selloW = doc.getTextWidth(t(`PRIORIDAD ${sello}`)) + 8;
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.roundedRect(PAGE.w - PAGE.mx - selloW, 20, selloW, 9, 1.2, 1.2, 'S');
  doc.text(t(`PRIORIDAD ${sello}`), PAGE.w - PAGE.mx - selloW / 2, 25.9, { align: 'center' });

  y = 44;

  const emision = new Date(d.fechaEmision);
  autoTable(doc, {
    ...tableBase,
    startY: y,
    theme: 'plain',
    styles: { ...tableBase.styles, fontSize: 8.6, cellPadding: { top: 1.3, bottom: 1.3, left: 2, right: 2 } },
    body: [
      ['Distrito', t(d.distrito.nombre), 'UBIGEO', t(d.distrito.ubigeo)],
      ['Provincia / Región', t(`${d.distrito.provincia}, ${d.distrito.departamento}`), 'Población', `${num(d.distrito.poblacion)} hab.`],
      ['Periodo de análisis', t(d.periodo), 'Superficie', t(`${d.distrito.areaKm2} km²`)],
      [
        'Índice de prioridad',
        t(`${pct(d.clasificacion.prioridad)} · ${d.clasificacion.categoria}`),
        'Ranking metropolitano',
        `${d.clasificacion.rankingMetropolitano} de ${d.clasificacion.totalDistritos}`,
      ],
      [
        'Vulnerabilidad',
        `Quintil ${d.clasificacion.quintil}`,
        'Fecha de emisión',
        t(emision.toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' })),
      ],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', textColor: C.muted, cellWidth: 36 },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', textColor: C.muted, cellWidth: 38 },
    },
    didDrawPage: () => {},
  });
  y = lastY() + 2;

  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.3);
  doc.line(PAGE.mx, y, PAGE.w - PAGE.mx, y);
  y += 3;

  /* ------------------------------------------------------------------------ */
  /* Cuerpo                                                                     */
  /* ------------------------------------------------------------------------ */

  let n = 1;

  sectionTitle(n++, 'Resumen ejecutivo');
  paragraph(d.narrativa.resumenEjecutivo, 10);

  sectionTitle(n++, 'Indicadores del gemelo digital');
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [['Dimensión', 'Indicador', 'Valor', 'Referencia', 'Estado']],
    body: d.indicadores.map((i) => [
      t(i.grupo),
      t(i.indicador),
      t(i.valor),
      t(i.referencia),
      ESTADO_LABEL[i.estado],
    ]),
    columnStyles: {
      0: { cellWidth: 32, textColor: C.muted },
      1: { cellWidth: 48 },
      2: { cellWidth: 36, fontStyle: 'bold' },
      3: { cellWidth: 42, textColor: C.muted },
      4: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 4) data.cell.styles.halign = 'center';
      if (data.section === 'body' && data.column.index === 4) {
        const estado = d.indicadores[data.row.index]?.estado;
        if (estado) data.cell.styles.textColor = C[estado];
      }
    },
  });
  y = lastY() + 3;

  sectionTitle(n++, 'Hallazgos principales');
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [['Severidad', 'Hallazgo', 'Evidencia']],
    body: d.narrativa.hallazgos.map((h) => [
      h.severidad.charAt(0).toUpperCase() + h.severidad.slice(1),
      t(h.titulo),
      t(h.detalle),
    ]),
    columnStyles: {
      0: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 52, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const sev = d.narrativa.hallazgos[data.row.index]?.severidad;
        if (sev) data.cell.styles.textColor = SEVERIDAD_COLOR[sev];
      }
    },
  });
  y = lastY() + 3;

  sectionTitle(n++, 'Descomposición del riesgo territorial');
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [['Factor', 'Dimensión', 'Peso', 'Puntuación', 'Impacto']],
    body: d.factoresRiesgo.map((f) => [
      t(f.factor),
      t(f.categoria),
      pct(f.peso),
      pct(f.puntuacion),
      t(f.impacto),
    ]),
    columnStyles: {
      0: { cellWidth: 66 },
      1: { cellWidth: 28, textColor: C.muted },
      2: { cellWidth: 16, halign: 'right' },
      3: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 'auto' },
    },
  });
  y = lastY() + 3;

  sectionTitle(n++, 'Oferta de servicios de salud (IPRESS)');
  if (d.ipress.length) {
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [['Establecimiento', 'Cat.', 'Estado', 'Horario', 'Capacidad', 'Demanda', 'Carga']],
      body: d.ipress.map((f) => [
        t(f.nombre),
        t(f.categoria),
        t(f.estado),
        t(f.horario),
        num(f.capacidad),
        num(f.demanda),
        pct(f.carga),
      ]),
      columnStyles: {
        0: { cellWidth: 58 },
        1: { cellWidth: 13, halign: 'center' },
        2: { cellWidth: 25 },
        3: { cellWidth: 19 },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          const carga = d.ipress[data.row.index]?.carga ?? 0;
          data.cell.styles.textColor = carga > 1 ? C.critico : C.adecuado;
        }
      },
    });
    y = lastY() + 3;
  } else {
    paragraph('No hay establecimientos registrados en el distrito.');
  }

  sectionTitle(n++, 'Recomendaciones priorizadas');
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [['N.°', 'Acción recomendada', 'Tipo', 'Plazo', 'Justificación']],
    body: d.narrativa.recomendaciones.map((r) => [
      String(r.prioridad),
      t(r.accion),
      t(r.tipo),
      t(r.plazo),
      t(r.justificacion),
    ]),
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: C.pine },
      1: { cellWidth: 50, fontStyle: 'bold' },
      2: { cellWidth: 26 },
      3: { cellWidth: 28, textColor: C.muted },
      4: { cellWidth: 'auto' },
    },
  });
  y = lastY() + 3;

  sectionTitle(n++, 'Efecto esperado en la red metropolitana');
  paragraph(d.narrativa.efectoRed);
  if (d.vecinos.length) {
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [['Distrito colindante', 'Índice de prioridad', 'Categoría', 'Presión asistencial']],
      body: d.vecinos.map((v) => [t(v.nombre), pct(v.prioridad), t(v.categoria), pct(v.presion)]),
      columnStyles: {
        1: { halign: 'right' },
        3: { halign: 'right' },
      },
    });
    y = lastY() + 3;
  }

  sectionTitle(n++, 'Limitaciones del análisis');
  d.narrativa.limitaciones.forEach((l) => paragraph(`•  ${l}`, 9));

  sectionTitle(n++, 'Cláusula ética y de responsabilidad');
  paragraph(d.notaEtica, 9);

  /* ------------------------------------------------------------------------ */
  /* Trazabilidad y conformidad                                                 */
  /* ------------------------------------------------------------------------ */

  const redaccion = t(
    `Redacción analítica: ${d.fuente.origen === 'langchain-agent' ? `agente LangChain (${d.fuente.modelo})` : d.fuente.modelo}. Todas las cifras de las tablas provienen del motor, no del modelo de lenguaje.`,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const lineasRedaccion = doc.splitTextToSize(redaccion, contentW - 8) as string[];
  const cajaH = 11 + lineasRedaccion.length * 3.6;

  ensureSpace(cajaH + 32);
  y += 4;
  doc.setFillColor(...C.wash);
  doc.setDrawColor(...C.line);
  doc.roundedRect(PAGE.mx, y, contentW, cajaH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.pineDark);
  doc.text(t('TRAZABILIDAD DE LA EVIDENCIA'), PAGE.mx + 4, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.ink);
  doc.text(t(`Motor de cálculo: ${d.fuente.motor}`), PAGE.mx + 4, y + 9.2);
  doc.text(lineasRedaccion, PAGE.mx + 4, y + 12.8);
  y += cajaH + 14;

  ensureSpace(20);
  const firmaW = (contentW - 20) / 2;
  [
    ['Elaborado por', 'Gemelo Digital Urbano de Salud'],
    ['Revisado y validado por', 'Nombre, cargo y colegiatura'],
  ].forEach(([rol, sub], i) => {
    const x = PAGE.mx + i * (firmaW + 20);
    doc.setDrawColor(...C.muted);
    doc.setLineWidth(0.3);
    doc.line(x, y + 8, x + firmaW, y + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.ink);
    doc.text(t(rol), x + firmaW / 2, y + 12.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text(t(sub), x + firmaW / 2, y + 16.5, { align: 'center' });
  });

  /* ------------------------------------------------------------------------ */
  /* Cabecera y pie en todas las páginas                                        */
  /* ------------------------------------------------------------------------ */

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);

    if (i > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.muted);
      doc.text(t(`Dictamen Técnico Epidemiológico — ${d.distrito.nombre}`), PAGE.mx, 12);
      doc.setFont('courier', 'normal');
      doc.text(t(d.codigo), PAGE.w - PAGE.mx, 12, { align: 'right' });
      doc.setDrawColor(...C.line);
      doc.setLineWidth(0.3);
      doc.line(PAGE.mx, 14.5, PAGE.w - PAGE.mx, 14.5);
    }

    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.3);
    doc.line(PAGE.mx, PAGE.h - 13, PAGE.w - PAGE.mx, PAGE.h - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(
      t('Documento generado automáticamente por el Gemelo Digital Urbano de Salud · Datos sintéticos de validación'),
      PAGE.mx,
      PAGE.h - 8.5,
    );
    doc.text(`Página ${i} de ${total}`, PAGE.w - PAGE.mx, PAGE.h - 8.5, { align: 'right' });
  }

  doc.save(`Dictamen_${d.distrito.nombre.replace(/\s+/g, '_')}_${d.codigo}.pdf`);
}

import React from 'react';
import type { AIModelBenchmark } from '../../types';
import { ViewContainer } from '../../components/layout/AppShell';
import { Badge, Card, CardBody, CardHeader, CardTitle, PageHeader, Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '../../components/ui';

export const AIModelsBenchmarkView: React.FC<{ models: AIModelBenchmark[] }> = ({ models }) => <ViewContainer>
  <PageHeader eyebrow="Analítica" title="Referencias predictivas evaluadas"
    description="Comparación retrospectiva de pronósticos deterministas sobre consultas externas SIS. Se muestra únicamente el error medido." />
  <Card flush><CardHeader><CardTitle>Error absoluto medio por método</CardTitle></CardHeader><TableWrap><Table>
    <Thead><tr><Th>Método</Th><Th align="right">MAE</Th><Th>Observaciones</Th><Th>Estado</Th></tr></Thead>
    <Tbody>{models.map((model) => <Tr key={model.id}><Td className="font-semibold">{model.name}</Td>
      <Td align="right">{Number.isFinite(model.mae) ? model.mae.toFixed(1) : 'Sin dato'}</Td>
      <Td>{model.notes}</Td><Td><Badge tone={model.status === 'Activo' ? 'positive' : 'neutral'}>{model.status}</Badge></Td>
    </Tr>)}</Tbody>
  </Table></TableWrap></Card>
  <Card><CardBody><p className="text-sm text-muted-foreground">La persistencia estacional usa el mismo mes del año anterior.
    La persistencia del último mes usa la última observación. La validación utiliza meses posteriores a los doce primeros,
    sin información futura en las entradas. La interfaz anterior describía una ST-GNN sin entrenamiento verificable;
    estos resultados corresponden solo a los dos métodos indicados.</p></CardBody></Card>
</ViewContainer>;

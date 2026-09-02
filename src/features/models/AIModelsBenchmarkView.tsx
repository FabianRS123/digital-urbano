import React from 'react';
import { AI_BENCHMARK_MODELS } from '../../data/trujilloData';
import { ViewContainer } from '../../components/layout/AppShell';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DataRow,
  Meter,
  PageHeader,
  Pill,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui';

const HYPERPARAMETERS = [
  { label: 'Capas Graph Attention', value: '2 capas GAT · 4 heads' },
  { label: 'Unidades ocultas LSTM', value: '64 bidireccionales' },
  { label: 'Tasa de aprendizaje', value: '0.001 · AdamW + cosine decay' },
  { label: 'Dropout espacial', value: '0.20' },
  { label: 'Función de pérdida', value: 'Smooth L1 + regularización de equidad' },
];

const ADVANTAGES = [
  {
    title: 'Topología del grafo urbano (matriz de adyacencia W)',
    body: 'A diferencia de XGBoost o Random Forest, que asumen independencia entre distritos, el ST-GNN propaga la influencia espacial mediante Graph Attention Networks: modela cómo la sobrecarga en Florencia de Mora desborda demanda hacia el centro de Trujillo.',
  },
  {
    title: 'Dependencias temporales multiescala',
    body: 'La capa recurrente Bi-LSTM captura patrones estacionales —invierno, brotes de dengue en verano— junto con tendencias demográficas de largo plazo.',
  },
  {
    title: 'Fusión de determinantes sociales (SDOH embedding)',
    body: 'Los vectores de características integran pobreza, déficit de saneamiento y tiempos de traslado como atributos nodales dinámicos.',
  },
];

export const AIModelsBenchmarkView: React.FC = () => {
  const bestR2 = Math.max(...AI_BENCHMARK_MODELS.map((m) => m.r2));

  return (
    <ViewContainer>
      <PageHeader
        eyebrow="Gobernanza"
        title="Modelos de IA y benchmarking"
        description="Comparativa experimental de arquitecturas predictivas sobre el dataset espacio-temporal de Trujillo."
        actions={<Badge tone="primary">ST-GNN en producción</Badge>}
      />

      <Card flush>
        <CardHeader>
          <CardTitle hint="Holdout espacio-temporal 2026">
            Desempeño en el conjunto de prueba
          </CardTitle>
          <Pill>{AI_BENCHMARK_MODELS.length} modelos evaluados</Pill>
        </CardHeader>

        <TableWrap>
          <Table className="min-w-[880px]">
            <Thead>
              <tr>
                <Th>Modelo / arquitectura</Th>
                <Th>Aprendizaje</Th>
                <Th align="right">MAE</Th>
                <Th align="right">RMSE</Th>
                <Th align="right">MAPE</Th>
                <Th align="right">R²</Th>
                <Th>Entrenamiento</Th>
                <Th align="center">Estado</Th>
              </tr>
            </Thead>
            <Tbody>
              {AI_BENCHMARK_MODELS.map((model) => (
                <Tr key={model.id} selected={model.isSelected}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-foreground">
                        {model.name}
                      </span>
                      {model.isSelected && <Badge tone="primary">Activo</Badge>}
                    </div>
                    <p className="mt-1 max-w-md text-[10.5px] leading-snug text-muted-foreground">
                      {model.description}
                    </p>
                  </Td>
                  <Td className="text-muted-foreground">{model.type}</Td>
                  <Td align="right" className="numeric font-mono font-semibold">
                    {model.mae.toFixed(1)}
                  </Td>
                  <Td align="right" className="numeric font-mono">
                    {model.rmse.toFixed(1)}
                  </Td>
                  <Td align="right" className="numeric font-mono">
                    {model.mape.toFixed(1)} %
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-2">
                      <Meter
                        value={model.r2 / bestR2}
                        className="h-1 w-12"
                        barClassName={
                          model.isSelected ? 'bg-primary' : 'bg-muted-foreground/50'
                        }
                      />
                      <span
                        className={
                          model.isSelected
                            ? 'numeric font-mono font-semibold text-primary'
                            : 'numeric font-mono text-foreground'
                        }
                      >
                        {model.r2.toFixed(3)}
                      </span>
                    </div>
                  </Td>
                  <Td className="font-mono text-[10.5px] text-muted-foreground">
                    {model.trainingTime}
                  </Td>
                  <Td align="center">
                    <Badge tone={model.isSelected ? 'positive' : 'neutral'}>
                      {model.status}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader>
            <CardTitle hint="GAT + Bi-LSTM">
              ¿Por qué el ST-GNN supera a los modelos tradicionales?
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 pt-4">
            {ADVANTAGES.map((item, idx) => (
              <div
                key={item.title}
                className="rounded-lg border border-border bg-surface-sunken/60 p-4"
              >
                <div className="flex items-baseline gap-2">
                  <span className="numeric font-mono text-[11px] font-semibold text-primary">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <h4 className="text-[12.5px] font-semibold text-foreground">
                    {item.title}
                  </h4>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle>Hiperparámetros calibrados</CardTitle>
          </CardHeader>
          <CardBody className="pt-2">
            <div className="divide-y divide-border">
              {HYPERPARAMETERS.map((param) => (
                <DataRow
                  key={param.label}
                  label={param.label}
                  value={
                    <span className="font-mono text-[10.5px] text-primary">
                      {param.value}
                    </span>
                  }
                  className="py-2.5"
                />
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </ViewContainer>
  );
};

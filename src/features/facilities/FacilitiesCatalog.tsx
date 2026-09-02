import React, { useMemo, useState } from 'react';
import { Building2, Search, SlidersHorizontal, X } from 'lucide-react';
import { HealthFacility, Territory } from '../../types';
import { ViewContainer } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CellStack,
  DataRow,
  EmptyState,
  Input,
  Meter,
  PageHeader,
  Pill,
  Select,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui';
import { formatNumber, formatPercent } from '../../lib/format';

interface FacilitiesCatalogProps {
  facilities: HealthFacility[];
  territories: Territory[];
  onSelectDistrict: (id: number) => void;
  onOpenSimulatorForFacility: (facility: HealthFacility) => void;
}

const CATEGORIES = ['I-1', 'I-2', 'I-3', 'I-4', 'II-1', 'II-2', 'III-1'];
const STATUSES = [
  'Operativo',
  'Sobrecargado',
  'Mantenimiento',
  'Cierre Temporal',
];

export const FacilitiesCatalog: React.FC<FacilitiesCatalogProps> = ({
  facilities,
  territories,
  onSelectDistrict,
  onOpenSimulatorForFacility,
}) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [active, setActive] = useState<HealthFacility | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return facilities.filter((f) => {
      const matchesSearch =
        !needle ||
        f.name.toLowerCase().includes(needle) ||
        f.code.toLowerCase().includes(needle) ||
        f.districtName.toLowerCase().includes(needle) ||
        f.address.toLowerCase().includes(needle);
      const matchesCategory = category === 'ALL' || f.category === category;
      const matchesDistrict =
        districtFilter === 'ALL' ||
        f.districtId === parseInt(districtFilter, 10);
      const matchesStatus = status === 'ALL' || f.operationalStatus === status;
      return (
        matchesSearch && matchesCategory && matchesDistrict && matchesStatus
      );
    });
  }, [facilities, search, category, districtFilter, status]);

  const hasFilters =
    search !== '' ||
    category !== 'ALL' ||
    districtFilter !== 'ALL' ||
    status !== 'ALL';

  const clearFilters = () => {
    setSearch('');
    setCategory('ALL');
    setDistrictFilter('ALL');
    setStatus('ALL');
  };

  return (
    <ViewContainer>
      <PageHeader
        eyebrow="Panorama"
        title="Catálogo de infraestructura IPRESS"
        description="Registro Nacional de Establecimientos de Salud (RENIPRESS / SUSALUD) en el Área Metropolitana de Trujillo."
        actions={
          <Badge tone="outline" mono>
            {filtered.length} de {facilities.length}
          </Badge>
        }
      />

      {/* Filtros --------------------------------------------------------- */}
      <Card>
        <CardBody className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, código o dirección…"
              className="pl-9"
              aria-label="Buscar establecimiento"
            />
          </div>

          <Select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            aria-label="Filtrar por distrito"
          >
            <option value="ALL">Todos los distritos</option>
            {territories.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>

          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filtrar por categoría"
          >
            <option value="ALL">Todas las categorías</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                Categoría {c}
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-2">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filtrar por estado operativo"
            >
              <option value="ALL">Todos los estados</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearFilters}
                title="Limpiar filtros"
                aria-label="Limpiar filtros"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Tabla + ficha --------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card
          flush
          className={active ? 'xl:col-span-8' : 'xl:col-span-12'}
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Building2 className="size-5" />}
              title="Ningún establecimiento coincide con los filtros"
              description="Ajusta los criterios de búsqueda para volver a ver resultados."
              action={
                <Button size="sm" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <TableWrap>
              <Table>
                <Thead>
                  <tr>
                    <Th>Establecimiento</Th>
                    <Th>Distrito</Th>
                    <Th align="center">Categoría</Th>
                    <Th>Horario</Th>
                    <Th align="right">Capacidad</Th>
                    <Th>Carga asistencial</Th>
                    <Th align="center">Estado</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {filtered.map((facility) => {
                    const overloaded =
                      facility.operationalStatus === 'Sobrecargado';
                    const overCapacity = facility.pressureRatio > 1;
                    return (
                      <Tr
                        key={facility.id}
                        interactive
                        selected={active?.id === facility.id}
                        onClick={() => setActive(facility)}
                      >
                        <Td>
                          <CellStack
                            primary={
                              <span className="flex items-center gap-2">
                                {facility.name}
                                {facility.isDemo && (
                                  <Badge tone="outline">Demo</Badge>
                                )}
                              </span>
                            }
                            secondary={`Cód. ${facility.code} · ${facility.type}`}
                          />
                        </Td>
                        <Td className="text-muted-foreground">
                          {facility.districtName}
                        </Td>
                        <Td align="center">
                          <Pill>{facility.category}</Pill>
                        </Td>
                        <Td className="text-muted-foreground">
                          {facility.schedule}
                        </Td>
                        <Td align="right">
                          <CellStack
                            className="text-right"
                            primary={formatNumber(facility.monthlyCapacity)}
                            secondary={`${facility.consultingRooms} consultorios`}
                          />
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <Meter
                              value={Math.min(facility.pressureRatio, 1.4) / 1.4}
                              reference={1 / 1.4}
                              referenceLabel="Capacidad instalada (100 %)"
                              barClassName={
                                overCapacity ? 'bg-negative' : 'bg-primary'
                              }
                              className="h-1 w-14"
                            />
                            <span
                              className={
                                overCapacity
                                  ? 'numeric font-semibold text-negative'
                                  : 'numeric font-semibold text-foreground'
                              }
                            >
                              {formatPercent(facility.pressureRatio)}
                            </span>
                          </div>
                        </Td>
                        <Td align="center">
                          <Badge tone={overloaded ? 'negative' : 'positive'}>
                            {facility.operationalStatus}
                          </Badge>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        {active && (
          <Card className="animate-fade-rise xl:col-span-4">
            <CardHeader>
              <CardTitle hint={`${active.districtName} · Cód. ${active.code}`}>
                {active.name}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActive(null)}
                aria-label="Cerrar ficha"
              >
                <X className="size-4" />
              </Button>
            </CardHeader>

            <CardBody className="space-y-4 pt-4">
              <div className="divide-y divide-border rounded-lg border border-border bg-surface-sunken/60 px-3">
                <DataRow
                  label="Categoría oficial"
                  value={`${active.category} · ${active.type}`}
                />
                <DataRow
                  label="Estado operativo"
                  value={
                    <span
                      className={
                        active.operationalStatus === 'Sobrecargado'
                          ? 'text-negative'
                          : 'text-positive'
                      }
                    >
                      {active.operationalStatus}
                    </span>
                  }
                />
                <DataRow label="Horario" value={active.schedule} />
                <DataRow
                  label="Consultorios / personal"
                  value={`${active.consultingRooms} / ${active.staffCount}`}
                />
                {active.phone && (
                  <DataRow label="Teléfono" value={active.phone} />
                )}
              </div>

              <div className="rounded-lg border border-border bg-surface-sunken/60 p-3">
                <div className="divide-y divide-border">
                  <DataRow
                    label="Capacidad mensual"
                    value={`${formatNumber(active.monthlyCapacity)} consultas`}
                  />
                  <DataRow
                    label="Demanda registrada"
                    value={`${formatNumber(active.currentMonthlyDemand)} atenciones`}
                  />
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-baseline justify-between text-[10.5px] font-semibold text-muted-foreground">
                    <span>Carga asistencial</span>
                    <span className="numeric">
                      {formatPercent(active.pressureRatio)}
                    </span>
                  </div>
                  <Meter
                    value={Math.min(active.pressureRatio, 1.4) / 1.4}
                    reference={1 / 1.4}
                    referenceLabel="Capacidad instalada (100%)"
                    barClassName={
                      active.pressureRatio > 1 ? 'bg-negative' : 'bg-primary'
                    }
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-surface-sunken/60 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Geolocalización
                </div>
                <p className="mt-1.5 text-[11.5px] text-foreground">
                  {active.address}
                </p>
                <p className="mt-1 font-mono text-[10px] text-subtle-foreground">
                  {active.latitude.toFixed(4)}, {active.longitude.toFixed(4)}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="primary"
                  className="justify-center"
                  onClick={() => onOpenSimulatorForFacility(active)}
                >
                  <SlidersHorizontal className="size-3.5" />
                  Simular ampliación o contingencia
                </Button>
                <Button
                  className="justify-center"
                  onClick={() => onSelectDistrict(active.districtId)}
                >
                  Ver distrito de {active.districtName}
                </Button>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </ViewContainer>
  );
};

import {
  AlertTriangle,
  Brain,
  Building2,
  Database,
  FileText,
  GitCompare,
  HelpCircle,
  History,
  LayoutDashboard,
  Map,
  MapPin,
  Scale,
  SlidersHorizontal,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

export type NavigationTab =
  | 'overview'
  | 'map'
  | 'territories'
  | 'facilities'
  | 'predictions'
  | 'hotspots'
  | 'explainability'
  | 'simulator'
  | 'comparison'
  | 'equity'
  | 'models'
  | 'datasources'
  | 'reports'
  | 'history';

export interface NavItem {
  id: NavigationTab;
  label: string;
  /** Descripción corta para tooltips y para la cabecera de cada vista. */
  description: string;
  icon: LucideIcon;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'panorama',
    label: 'Panorama',
    items: [
      {
        id: 'overview',
        label: 'Resumen ejecutivo',
        description: 'Indicadores clave del área metropolitana',
        icon: LayoutDashboard,
      },
      {
        id: 'map',
        label: 'Mapa metropolitano',
        description: 'Visor cartográfico espacio-temporal',
        icon: Map,
      },
      {
        id: 'territories',
        label: 'Detalle territorial',
        description: 'Perfil analítico por distrito',
        icon: MapPin,
      },
      {
        id: 'facilities',
        label: 'Infraestructura IPRESS',
        description: 'Catálogo de establecimientos de salud',
        icon: Building2,
      },
    ],
  },
  {
    id: 'analitica',
    label: 'Analítica',
    items: [
      {
        id: 'predictions',
        label: 'Predicción ST-GNN',
        description: 'Proyección espacio-temporal de demanda',
        icon: TrendingUp,
      },
      {
        id: 'hotspots',
        label: 'Hotspots y prioridad',
        description: 'Índice de priorización territorial',
        icon: AlertTriangle,
      },
      {
        id: 'explainability',
        label: 'Explicación del riesgo',
        description: 'Atribución interpretable de factores',
        icon: HelpCircle,
      },
    ],
  },
  {
    id: 'simulacion',
    label: 'Simulación',
    items: [
      {
        id: 'simulator',
        label: 'Simulador What-If',
        description: 'Escenarios contrafácticos de intervención',
        icon: SlidersHorizontal,
      },
      {
        id: 'comparison',
        label: 'Comparar escenarios',
        description: 'Antes y después de la intervención',
        icon: GitCompare,
      },
      {
        id: 'history',
        label: 'Escenarios guardados',
        description: 'Historial de simulaciones de la sesión',
        icon: History,
      },
    ],
  },
  {
    id: 'gobernanza',
    label: 'Gobernanza',
    items: [
      {
        id: 'equity',
        label: 'Equidad y fairness',
        description: 'Auditoría de sesgos del modelo',
        icon: Scale,
      },
      {
        id: 'models',
        label: 'Modelos de IA',
        description: 'Benchmarking de arquitecturas predictivas',
        icon: Brain,
      },
      {
        id: 'datasources',
        label: 'Fuentes de datos',
        description: 'Pipeline de ingesta y gobernanza',
        icon: Database,
      },
      {
        id: 'reports',
        label: 'Reportes',
        description: 'Informes ejecutivos y exportación',
        icon: FileText,
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const getNavItem = (tab: NavigationTab): NavItem =>
  NAV_ITEMS.find((item) => item.id === tab) ?? NAV_ITEMS[0];

export const USER_ROLES = [
  'Administrador',
  'Investigador',
  'Analista de Salud',
  'Invitado',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

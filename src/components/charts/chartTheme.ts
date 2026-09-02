import { useMemo, type CSSProperties } from 'react';
import { useThemeContext } from '../../app/ThemeProvider';
import { readCssColor } from '../../lib/risk';

export interface ChartTheme {
  grid: string;
  axis: string;
  text: string;
  surface: string;
  border: string;
  series: [string, string, string, string, string];
  risk: { low: string; medium: string; high: string; critical: string };
  positive: string;
  negative: string;
  warning: string;
  info: string;
  tooltip: CSSProperties;
  axisTick: { fontSize: number; fill: string };
}

/**
 * Recharts no entiende clases de Tailwind: resolvemos los colores reales
 * desde las variables CSS y recalculamos cuando cambia el tema.
 */
export function useChartTheme(): ChartTheme {
  const { theme } = useThemeContext();

  return useMemo(() => {
    const border = readCssColor('--border', '#d9dedb');
    const text = readCssColor('--muted-foreground', '#686868');
    const surface = readCssColor('--popover', '#ffffff');
    const foreground = readCssColor('--foreground', '#2d3319');

    return {
      grid: border,
      axis: border,
      text,
      surface,
      border,
      series: [
        readCssColor('--series-1', '#517664'),
        readCssColor('--series-2', '#9fd8cb'),
        readCssColor('--series-3', '#a8873f'),
        readCssColor('--series-4', '#4a6b80'),
        readCssColor('--series-5', '#8f7f9c'),
      ],
      risk: {
        low: readCssColor('--risk-low', '#517664'),
        medium: readCssColor('--risk-medium', '#a8873f'),
        high: readCssColor('--risk-high', '#c0703f'),
        critical: readCssColor('--risk-critical', '#9e4a3c'),
      },
      positive: readCssColor('--positive', '#3f7a5f'),
      negative: readCssColor('--negative', '#9e4a3c'),
      warning: readCssColor('--warning', '#a8873f'),
      info: readCssColor('--info', '#4a6b80'),
      tooltip: {
        backgroundColor: surface,
        border: `1px solid ${border}`,
        borderRadius: '10px',
        fontSize: '11.5px',
        color: foreground,
        boxShadow: '0 8px 24px -8px rgb(0 0 0 / 0.18)',
        padding: '8px 10px',
      },
      axisTick: { fontSize: 10, fill: text },
    };
    // `theme` es la dependencia real: al cambiar, las variables CSS ya
    // están aplicadas en el DOM y hay que releerlas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}

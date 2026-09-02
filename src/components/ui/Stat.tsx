import React from 'react';
import { cn } from '../../lib/utils';

type Tone = 'neutral' | 'positive' | 'negative';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'text-muted-foreground',
  positive: 'text-positive',
  negative: 'text-negative',
};

/**
 * Tarjeta de indicador. La jerarquía es: etiqueta pequeña, cifra grande,
 * contexto discreto. Sin gradientes ni iconos de color: el dato es el héroe.
 */
export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  unit?: string;
  delta?: string;
  deltaTone?: Tone;
  hint?: string;
  accent?: boolean;
  className?: string;
}> = ({
  label,
  value,
  unit,
  delta,
  deltaTone = 'neutral',
  hint,
  accent,
  className,
}) => (
  <div
    className={cn(
      'relative flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-xs',
      accent && 'border-primary/30 bg-primary/[0.04]',
      className,
    )}
  >
    <span className="text-[10px] font-semibold uppercase leading-4 tracking-[0.13em] text-muted-foreground">
      {label}
    </span>

    <div className="flex items-baseline gap-1.5">
      <span className="numeric text-[26px] font-semibold leading-none tracking-tight text-foreground">
        {value}
      </span>
      {unit && (
        <span className="text-xs font-medium text-muted-foreground">{unit}</span>
      )}
    </div>

    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px]">
      {delta && (
        // Sin flecha: el signo ya indica la dirección y el color, si el
        // cambio es favorable. Una flecha ligada al tono contradecía al signo
        // (p. ej. "+51 pts" de presión es malo, pero no es una bajada).
        <span className={cn('font-semibold', TONE_CLASS[deltaTone])}>
          {delta}
        </span>
      )}
      {hint && <span className="text-subtle-foreground">{hint}</span>}
    </div>
  </div>
);

/** Fila etiqueta / valor para fichas técnicas. */
export const DataRow: React.FC<{
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}> = ({ label, value, className }) => (
  <div
    className={cn(
      'flex items-baseline justify-between gap-4 py-1.5 text-[11.5px]',
      className,
    )}
  >
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-semibold text-foreground">{value}</span>
  </div>
);

/**
 * Barra de progreso con marcador de referencia opcional.
 * `value` y `reference` son proporciones 0–1.
 */
export const Meter: React.FC<{
  value: number;
  reference?: number;
  /** Clase de color del relleno; por defecto el color de marca. */
  barClassName?: string;
  className?: string;
  referenceLabel?: string;
}> = ({ value, reference, barClassName, className, referenceLabel }) => {
  const pct = Math.min(Math.max(value, 0), 1) * 100;
  return (
    <div
      className={cn(
        'relative h-1.5 w-full overflow-hidden rounded-full bg-muted',
        className,
      )}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', barClassName ?? 'bg-primary')}
        style={{ width: `${pct}%` }}
      />
      {reference !== undefined && (
        <span
          title={referenceLabel}
          className="absolute inset-y-0 w-px bg-foreground/45"
          style={{ left: `${Math.min(Math.max(reference, 0), 1) * 100}%` }}
        />
      )}
    </div>
  );
};

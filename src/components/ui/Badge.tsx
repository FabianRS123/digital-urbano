import React from 'react';
import { cn } from '../../lib/utils';

type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'info'
  | 'outline';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-muted-foreground border-transparent',
  primary: 'bg-primary/10 text-primary border-primary/25',
  positive: 'bg-positive/10 text-positive border-positive/25',
  negative: 'bg-negative/10 text-negative border-negative/25',
  warning: 'bg-warning/12 text-warning border-warning/25',
  info: 'bg-info/10 text-info border-info/25',
  outline: 'bg-transparent text-muted-foreground border-border',
};

export const Badge: React.FC<{
  children: React.ReactNode;
  tone?: BadgeTone;
  /** Sobrescribe el tono con clases propias (p. ej. la escala de riesgo). */
  className?: string;
  mono?: boolean;
  dot?: boolean;
}> = ({ children, tone = 'neutral', className, mono, dot }) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10.5px] font-semibold leading-5 tracking-wide',
      mono && 'font-mono tracking-normal',
      TONES[tone],
      className,
    )}
  >
    {dot && (
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
    )}
    {children}
  </span>
);

/** Píldora discreta para metadatos (código, categoría, periodo…). */
export const Pill: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground',
      className,
    )}
  >
    {children}
  </span>
);

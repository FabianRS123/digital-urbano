import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Superficie base de la interfaz. Bordes de 1px, radio contenido y sombra
 * casi imperceptible: el peso visual lo aporta el contenido, no el marco.
 */
export const Card: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { flush?: boolean }
> = ({ className, flush, ...props }) => (
  <div
    className={cn(
      'bg-card border border-border rounded-xl shadow-xs',
      flush ? 'overflow-hidden' : '',
      className,
    )}
    {...props}
  />
);

export const CardHeader: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { border?: boolean }
> = ({ className, border = true, ...props }) => (
  <div
    className={cn(
      'flex flex-wrap items-start justify-between gap-3 px-5 py-4',
      border && 'border-b border-border',
      className,
    )}
    {...props}
  />
);

export const CardTitle: React.FC<{
  children: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}> = ({ children, hint, icon, className }) => (
  <div className={cn('min-w-0', className)}>
    <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-foreground">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="truncate">{children}</span>
    </h3>
    {hint && (
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
        {hint}
      </p>
    )}
  </div>
);

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn('p-5', className)} {...props} />;

/** Encabezado de sección a nivel de página (fuera de una tarjeta). */
export const PageHeader: React.FC<{
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}> = ({ eyebrow, title, description, actions }) => (
  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div className="min-w-0">
      {eyebrow && (
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-foreground">
        {title}
      </h2>
      {description && (
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
    {actions && (
      <div className="flex flex-wrap items-center gap-2 print-hidden">
        {actions}
      </div>
    )}
  </div>
);

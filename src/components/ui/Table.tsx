import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Tabla de datos densa. Sin bordes verticales ni rayado alterno: la lectura
 * se apoya en la alineación y en un único separador horizontal muy tenue.
 */
export const TableWrap: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn('w-full overflow-x-auto', className)} {...props} />;

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({
  className,
  ...props
}) => (
  <table
    className={cn('w-full min-w-[640px] border-collapse text-left', className)}
    {...props}
  />
);

export const Thead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  ...props
}) => (
  <thead
    className={cn(
      'border-b border-border text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground',
      className,
    )}
    {...props}
  />
);

export const Tbody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  ...props
}) => (
  <tbody className={cn('divide-y divide-border', className)} {...props} />
);

export const Th: React.FC<
  React.ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }
> = ({ className, align = 'left', ...props }) => (
  <th
    scope="col"
    className={cn(
      'whitespace-nowrap px-3 py-2.5 font-semibold first:pl-5 last:pr-5',
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      className,
    )}
    {...props}
  />
);

export const Tr: React.FC<
  React.HTMLAttributes<HTMLTableRowElement> & { selected?: boolean; interactive?: boolean }
> = ({ className, selected, interactive, ...props }) => (
  <tr
    className={cn(
      'transition-colors',
      interactive && 'cursor-pointer hover:bg-muted/60',
      selected && 'bg-primary/[0.07]',
      className,
    )}
    {...props}
  />
);

export const Td: React.FC<
  React.TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }
> = ({ className, align = 'left', ...props }) => (
  <td
    className={cn(
      'px-3 py-3 align-middle text-[11.5px] text-foreground first:pl-5 last:pr-5',
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      className,
    )}
    {...props}
  />
);

/** Celda con valor principal y subtítulo. */
export const CellStack: React.FC<{
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  className?: string;
}> = ({ primary, secondary, className }) => (
  <div className={cn('min-w-0', className)}>
    <div className="truncate font-semibold text-foreground">{primary}</div>
    {secondary && (
      <div className="mt-0.5 truncate text-[10px] font-normal text-muted-foreground">
        {secondary}
      </div>
    )}
  </div>
);

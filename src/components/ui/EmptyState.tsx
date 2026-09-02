import React from 'react';
import { cn } from '../../lib/utils';

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon, title, description, action, className }) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
      className,
    )}
  >
    <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
      {icon}
    </div>
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    {description && (
      <p className="max-w-sm text-[12px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    )}
    {action && <div className="pt-1">{action}</div>}
  </div>
);

/** Aviso enmarcado para notas éticas, advertencias y disclaimers. */
export const Callout: React.FC<{
  icon?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
  tone?: 'neutral' | 'warning' | 'info';
  className?: string;
}> = ({ icon, title, children, tone = 'neutral', className }) => {
  const tones = {
    neutral: 'border-border bg-muted/50',
    warning: 'border-warning/30 bg-warning/[0.07]',
    info: 'border-info/25 bg-info/[0.06]',
  } as const;

  const iconTones = {
    neutral: 'text-muted-foreground',
    warning: 'text-warning',
    info: 'text-info',
  } as const;

  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border p-4 text-[11.5px] leading-relaxed',
        tones[tone],
        className,
      )}
    >
      {icon && (
        <span className={cn('mt-0.5 shrink-0', iconTones[tone])}>{icon}</span>
      )}
      <div className="min-w-0 text-muted-foreground">
        {title && (
          <div className="mb-1 text-[12px] font-semibold text-foreground">
            {title}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

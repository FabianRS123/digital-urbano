import React from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
type Size = 'sm' | 'md' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground border-transparent hover:bg-primary-hover shadow-xs',
  secondary:
    'bg-surface text-foreground border-border hover:bg-muted hover:border-border-strong',
  ghost:
    'bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:text-foreground',
  danger:
    'bg-negative/10 text-negative border-negative/25 hover:bg-negative hover:text-white',
  link: 'bg-transparent border-transparent text-primary hover:text-primary-hover underline-offset-4 hover:underline p-0 h-auto',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[11.5px] gap-1.5',
  md: 'h-9 px-3.5 text-xs gap-2',
  icon: 'size-8 justify-center',
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = 'secondary', size = 'md', type = 'button', ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex shrink-0 cursor-pointer items-center rounded-lg border font-semibold transition-colors duration-150',
          'disabled:pointer-events-none disabled:opacity-50',
          variant !== 'link' && SIZES[size],
          VARIANTS[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

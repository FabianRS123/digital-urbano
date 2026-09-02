import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

/* -------------------------------------------------------------------------- */
/* Etiqueta                                                                    */
/* -------------------------------------------------------------------------- */

export const FieldLabel: React.FC<{
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}> = ({ children, htmlFor, className }) => (
  <label
    htmlFor={htmlFor}
    className={cn(
      'block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground',
      className,
    )}
  >
    {children}
  </label>
);

/* -------------------------------------------------------------------------- */
/* Input                                                                       */
/* -------------------------------------------------------------------------- */

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-lg border border-input bg-surface px-3 text-xs text-foreground',
        'placeholder:text-subtle-foreground transition-colors',
        'hover:border-border-strong focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20',
        className,
      )}
      {...props}
    />
  );
});

/* -------------------------------------------------------------------------- */
/* Select                                                                      */
/* -------------------------------------------------------------------------- */

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(
          'h-9 w-full cursor-pointer appearance-none rounded-lg border border-input bg-surface',
          'pl-3 pr-8 text-xs font-medium text-foreground transition-colors',
          'hover:border-border-strong focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Slider                                                                      */
/* -------------------------------------------------------------------------- */

export const Slider: React.FC<{
  label: string;
  value: number;
  displayValue: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}> = ({ label, value, displayValue, hint, min, max, step, onChange }) => (
  <div className="space-y-2">
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11.5px] font-medium text-foreground">{label}</span>
      <span className="font-mono text-xs font-semibold text-primary">
        {displayValue}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary"
      aria-label={label}
    />
    {hint && (
      <p className="text-[10.5px] leading-relaxed text-muted-foreground">
        {hint}
      </p>
    )}
  </div>
);

/* -------------------------------------------------------------------------- */
/* Segmented control                                                           */
/* -------------------------------------------------------------------------- */

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label && (
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
      )}
      <div
        role="group"
        className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-sunken p-0.5"
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.value)}
              className={cn(
                'cursor-pointer rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
                active
                  ? 'bg-surface text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Checkbox                                                                    */
/* -------------------------------------------------------------------------- */

export const Checkbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  hint?: string;
  swatch?: string;
}> = ({ checked, onChange, label, hint, swatch }) => (
  <label className="flex cursor-pointer select-none items-start gap-2.5 rounded-md py-1 text-[11.5px] transition-colors hover:text-foreground">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 size-3.5 cursor-pointer rounded border-border"
    />
    <span className="min-w-0 flex-1">
      <span
        className={cn(
          'flex items-center gap-1.5 font-medium',
          checked ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {swatch && (
          <span
            className="size-2 shrink-0 rounded-[3px]"
            style={{ backgroundColor: swatch }}
            aria-hidden="true"
          />
        )}
        {label}
      </span>
      {hint && (
        <span className="mt-0.5 block text-[10px] text-subtle-foreground">
          {hint}
        </span>
      )}
    </span>
  </label>
);

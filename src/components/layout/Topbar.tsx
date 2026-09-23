import React from 'react';
import {
  Menu,
  Moon,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  UserRound,
} from 'lucide-react';
import { USER_ROLES } from '../../app/navigation';
import { useThemeContext } from '../../app/ThemeProvider';
import { Button } from '../ui/Button';
import { Select } from '../ui/Field';
import { cn } from '../../lib/utils';

interface TopbarProps {
  months: { key: string; label: string; isProjected: boolean }[];
  currentMonthIndex: number;
  onSelectMonthIndex: (idx: number) => void;
  isPlayingTimeline: boolean;
  onTogglePlayTimeline: () => void;
  onResetTimeline: () => void;
  currentRole: string;
  onSelectRole: (role: string) => void;
  onOpenSimulator: () => void;
  onOpenNav: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  months,
  currentMonthIndex,
  onSelectMonthIndex,
  isPlayingTimeline,
  onTogglePlayTimeline,
  onResetTimeline,
  currentRole,
  onSelectRole,
  onOpenSimulator,
  onOpenNav,
}) => {
  const { theme, toggleTheme } = useThemeContext();
  const currentMonth = months[currentMonthIndex];
  const progress =
    (currentMonthIndex / Math.max(months.length - 1, 1)) * 100;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-5">
        {/* Identidad ---------------------------------------------------- */}
        <button
          type="button"
          onClick={onOpenNav}
          className="-ml-1 cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
          aria-label="Abrir navegación"
        >
          <Menu className="size-4.5" />
        </button>

        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-mono text-[11px] font-bold tracking-tight text-primary-foreground">
            GD
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-semibold leading-tight tracking-tight text-foreground">
              Gemelo Digital Urbano de Salud
            </h1>
            <p className="hidden truncate text-[10.5px] leading-tight text-muted-foreground sm:block">
              Área Metropolitana de Trujillo · La Libertad, Perú
            </p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Navegador temporal ------------------------------------------- */}
        <div className="hidden items-center gap-2 rounded-lg border border-border bg-surface-sunken px-1.5 py-1 md:flex">
          <span className="pl-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Periodo
          </span>
          <Select
            value={currentMonthIndex}
            onChange={(e) => onSelectMonthIndex(parseInt(e.target.value, 10))}
            className="h-7 w-[168px] border-transparent bg-surface text-[11.5px]"
            aria-label="Periodo de análisis"
          >
            {months.map((m, idx) => (
              <option key={m.key} value={idx}>
                {m.label}
                {m.isProjected ? ' · proyección' : ''}
              </option>
            ))}
          </Select>

          <button
            type="button"
            onClick={onTogglePlayTimeline}
            title={
              isPlayingTimeline
                ? 'Pausar evolución temporal'
                : `Reproducir evolución ${months[0]?.key ?? ''} – ${months.at(-1)?.key ?? ''}`
            }
            aria-label={
              isPlayingTimeline ? 'Pausar línea de tiempo' : 'Reproducir línea de tiempo'
            }
            className={cn(
              'flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors',
              isPlayingTimeline
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-surface hover:text-foreground',
            )}
          >
            {isPlayingTimeline ? (
              <Pause className="size-3.5" />
            ) : (
              <Play className="size-3.5 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={onResetTimeline}
            title="Volver al periodo actual"
            aria-label="Volver al periodo actual"
            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>

        {/* Estado del modelo -------------------------------------------- */}
        <div className="hidden items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 xl:flex">
          <span className="size-1.5 rounded-full bg-positive animate-soft-pulse" />
          <span className="text-[10.5px] font-medium text-muted-foreground">
            Datos SIS disponibles
          </span>
        </div>

        {/* Rol ----------------------------------------------------------- */}
        <div className="hidden items-center gap-1.5 rounded-lg border border-border px-2 py-1 lg:flex">
          <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
          <select
            value={currentRole}
            onChange={(e) => onSelectRole(e.target.value)}
            aria-label="Rol de usuario"
            className="cursor-pointer border-none bg-transparent pr-1 text-[11.5px] font-medium text-foreground outline-none"
          >
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {/* Tema ---------------------------------------------------------- */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label="Cambiar tema"
          className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {theme === 'dark' ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </button>

        <Button variant="primary" size="sm" onClick={onOpenSimulator}>
          <SlidersHorizontal className="size-3.5" />
          <span className="hidden sm:inline">Simulador</span>
        </Button>
      </div>

      {/* Progreso de la línea de tiempo ---------------------------------- */}
      <div className="relative h-[2px] w-full bg-border/60">
        <div
          className="h-full bg-primary transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
        {currentMonth?.isProjected && (
          <span className="absolute right-3 top-1 rounded-b bg-warning/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-warning">
            Horizonte proyectado
          </span>
        )}
      </div>
    </header>
  );
};

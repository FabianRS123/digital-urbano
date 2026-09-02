import React from 'react';
import { X } from 'lucide-react';
import { NAV_GROUPS, NavigationTab } from '../../app/navigation';
import { cn } from '../../lib/utils';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  savedScenariosCount: number;
  /** Visible en móvil como panel deslizante. */
  open: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  savedScenariosCount,
  open,
  onClose,
}) => {
  const handleSelect = (tab: NavigationTab) => {
    onSelectTab(tab);
    onClose();
  };

  return (
    <>
      {/* Velo para móvil */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-foreground/25 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'z-40 flex w-[248px] shrink-0 flex-col border-r border-border bg-surface',
          'fixed inset-y-0 left-0 transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Navegación principal"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 lg:hidden">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Módulos
          </span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Cerrar navegación"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.id}>
              <div className="px-2.5 pb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-subtle-foreground">
                {group.label}
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = currentTab === item.id;
                  const badge =
                    item.id === 'history' && savedScenariosCount > 0
                      ? String(savedScenariosCount)
                      : null;

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        aria-current={active ? 'page' : undefined}
                        title={item.description}
                        className={cn(
                          'group relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12.5px] font-medium transition-colors',
                          active
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {active && (
                          <span
                            className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r-full bg-primary"
                            aria-hidden="true"
                          />
                        )}
                        <Icon
                          className={cn(
                            'size-4 shrink-0',
                            active
                              ? 'text-primary'
                              : 'text-subtle-foreground group-hover:text-muted-foreground',
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-left">
                          {item.label}
                        </span>
                        {badge && (
                          <span
                            className={cn(
                              'numeric rounded px-1.5 py-px text-[10px] font-semibold',
                              active
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {badge}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-border px-4 py-3.5">
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            Proyecto académico
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-subtle-foreground">
            Modelo espacio-temporal sensible a la equidad. Datos sintéticos para
            validación de arquitectura.
          </p>
          <p className="mt-2 font-mono text-[9.5px] text-subtle-foreground">
            Gemelo Digital Trujillo v1.0
          </p>
        </div>
      </aside>
    </>
  );
};

import React from 'react';
import { Sidebar } from './Sidebar';
import { NavigationTab } from '../../app/navigation';

interface AppShellProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  savedScenariosCount: number;
  navOpen: boolean;
  onCloseNav: () => void;
  topbar: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Estructura de dos columnas con scroll independiente en el área de trabajo:
 * la barra superior y la navegación permanecen fijas mientras se explora.
 */
export const AppShell: React.FC<AppShellProps> = ({
  currentTab,
  onSelectTab,
  savedScenariosCount,
  navOpen,
  onCloseNav,
  topbar,
  children,
}) => (
  <div className="flex h-dvh overflow-hidden bg-background text-foreground">
    <Sidebar
      currentTab={currentTab}
      onSelectTab={onSelectTab}
      savedScenariosCount={savedScenariosCount}
      open={navOpen}
      onClose={onCloseNav}
    />

    <div className="flex min-w-0 flex-1 flex-col">
      {topbar}
      <main className="flex-1 overflow-y-auto scroll-smooth">
        <div key={currentTab} className="animate-fade-rise">
          {children}
        </div>
      </main>
    </div>
  </div>
);

/** Contenedor estándar de una vista. */
export const ViewContainer: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 lg:p-6">
    {children}
  </div>
);

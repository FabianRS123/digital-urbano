import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'gdu-trujillo-theme';

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const attr = document.documentElement.dataset.theme;
  if (attr === 'light' || attr === 'dark') return attr;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyToDocument(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* almacenamiento no disponible (modo privado): el tema sigue funcionando */
  }
}

/**
 * Tema aplicado como `data-theme` en <html>.
 *
 * El atributo se escribe de forma síncrona en el mismo evento que cambia el
 * estado: así, cuando los gráficos releen las variables CSS durante el render,
 * ya encuentran los valores del tema nuevo. Los componentes de `mapcn`
 * observan ese mismo atributo, de modo que el basemap cambia a la vez.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  // Sincroniza el valor inicial (por si el script del documento no corrió).
  useEffect(() => {
    applyToDocument(theme);
    // solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyToDocument(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      applyToDocument(next);
      return next;
    });
  }, []);

  return { theme, setTheme, toggleTheme };
}

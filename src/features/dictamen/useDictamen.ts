import { useCallback, useState } from 'react';
import { DictamenTecnico } from '../../types';

/** Solicita el dictamen estructurado de un distrito al servidor. */
export function useDictamen() {
  const [dictamen, setDictamen] = useState<DictamenTecnico | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generar = useCallback(async (districtId: number, userRole = 'Investigador', datasetVersion?: string, monthKey?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ districtId, userRole, datasetVersion, monthKey }),
      });
      if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
      const data = await res.json();
      setDictamen(data.dictamen);
    } catch (err) {
      console.error(err);
      setError('No se pudo generar el dictamen. Verifica que el servidor esté activo e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { dictamen, loading, error, generar, limpiar: () => setDictamen(null) };
}

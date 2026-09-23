import { useCallback, useState } from 'react';

/** Pide a Langflow una recomendación operativa. No genera el dictamen. */
export function useLangflowRecomendacion() {
  const [texto, setTexto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generar = useCallback(async (districtId: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/langflow/recomendacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ districtId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || `El servidor respondió ${res.status}`);
      }
      setTexto(data.recomendacion);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo pedir la recomendación a Langflow.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  return { texto, loading, error, generar, limpiar: () => setTexto(null) };
}

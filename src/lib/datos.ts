import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Temporada } from './tipos';

/** Ejecuta una consulta al montar y permite repetirla con `recargar`. */
export function useConsulta<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [cargando, setCargando] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ejecutar = useCallback(fn, deps);
  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await ejecutar());
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setCargando(false);
    }
  }, [ejecutar]);
  useEffect(() => {
    recargar();
  }, [recargar]);
  return { datos, error, cargando, recargar };
}

/** Lanza el error de Supabase si lo hay; si no, devuelve los datos. */
export function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export async function temporadaActiva(): Promise<Temporada | null> {
  return ok(await supabase.from('temporadas').select('*').eq('activa', true).maybeSingle()) as Temporada | null;
}

/** Socios con la cuota de la temporada activa al día (o exentos). Sirve a la taquilla: no incluye importes. */
export async function cuotasAlDia(): Promise<Map<number, boolean>> {
  const filas = ok(await supabase.rpc('cuotas_al_dia')) as { socio_id: number; al_dia: boolean }[];
  return new Map(filas.map((f) => [f.socio_id, f.al_dia]));
}

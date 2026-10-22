import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configurado = Boolean(url && clave);

export const supabase = createClient(url ?? 'http://localhost', clave ?? 'sin-configurar', {
  auth: { persistSession: true, autoRefreshToken: true },
});

/** Convierte los errores de Supabase/Postgres en un mensaje legible. */
export function mensajeError(e: unknown): string {
  if (!e) return 'Error desconocido';
  if (typeof e === 'string') return e;
  const m = (e as { message?: string }).message ?? String(e);
  if (m.includes('duplicate key') && m.includes('socios_numero')) return 'Ya existe un socio con ese número';
  if (m.includes('Failed to fetch')) return 'Sin conexión. Revisa la cobertura o el wifi.';
  if (m.includes('Invalid login credentials')) return 'Email o contraseña incorrectos';
  return m;
}

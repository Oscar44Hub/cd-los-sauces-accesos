import type { Parentesco, TipoSocio } from './tipos';

export const PARENTESCOS: Record<Parentesco, string> = {
  titular: 'Titular',
  conyuge: 'Cónyuge / pareja',
  hijo: 'Hijo/a',
  abuelo: 'Abuelo/a',
  otro: 'Otro familiar',
};

export const TIPOS_SOCIO: Record<TipoSocio, string> = {
  familiar: 'Familiar',
  individual: 'Individual',
};

/** Fecha de hoy (AAAA-MM-DD) en hora de España, sea cual sea la zona del móvil. */
export function hoyISO(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(ahora);
}

export function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(fechaISO + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function edad(fechaNacimiento: string | null, hoy: string = hoyISO()): number | null {
  if (!fechaNacimiento) return null;
  const [a, m, d] = fechaNacimiento.split('-').map(Number);
  const [ha, hm, hd] = hoy.split('-').map(Number);
  let e = ha - a;
  if (hm < m || (hm === m && hd < d)) e--;
  return e;
}

export function fecha(fechaISO: string | null | undefined): string {
  if (!fechaISO) return '';
  const [a, m, d] = fechaISO.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function hora(fechaHora: string): string {
  return new Date(fechaHora).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  });
}

export function euros(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

export function nombreCompleto(p: { nombre: string; apellidos?: string | null }): string {
  return [p.nombre, p.apellidos].filter(Boolean).join(' ');
}

/** Etiquetas que se muestran junto al nombre (fundador, jubilado, menor…) */
export function etiquetas(p: {
  es_fundador?: boolean;
  es_jubilado?: boolean;
  edad?: number | null;
}): string[] {
  const r: string[] = [];
  if (p.es_fundador) r.push('Fundador');
  if (p.es_jubilado) r.push('Jubilado');
  if (p.edad != null && p.edad < 14) r.push('Menor de 14');
  return r;
}

/** Quita acentos y mayúsculas para buscar "garcia" y encontrar "García". */
export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Enlace público al carnet digital (o pase de invitado) */
export function enlaceCarnet(codigo: string): string {
  const base = window.location.href.split('#')[0];
  return `${base}#/carnet/${codigo}`;
}

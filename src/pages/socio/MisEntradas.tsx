import { supabase } from '../../lib/supabase';
import { ok, useConsulta } from '../../lib/datos';
import { fecha, hora, nombreCompleto } from '../../lib/formato';

interface Entrada {
  id: number;
  fecha_hora: string;
  tipo: 'entrada' | 'salida';
  resultado: 'autorizado' | 'denegado';
  motivo: string | null;
  personas: { nombre: string; apellidos: string } | null;
  pases_dia: { nombre_invitado: string } | null;
}

/** Historial de entradas y salidas de la familia y de sus invitados */
export function MisEntradas() {
  const { datos } = useConsulta(
    async () =>
      ok(
        await supabase
          .from('accesos')
          .select('id, fecha_hora, tipo, resultado, motivo, personas(nombre, apellidos), pases_dia(nombre_invitado)')
          .order('fecha_hora', { ascending: false })
          .limit(300),
      ) as unknown as Entrada[],
  );

  // Agrupadas por día
  const dias = new Map<string, Entrada[]>();
  for (const e of datos ?? []) {
    const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(e.fecha_hora));
    dias.set(d, [...(dias.get(d) ?? []), e]);
  }

  return (
    <div className="pila">
      <h2>Entradas a la piscina</h2>
      {datos && datos.length === 0 && <p className="tenue">Todavía no hay entradas registradas.</p>}
      {[...dias.entries()].map(([d, lista]) => (
        <section key={d} className="tarjeta">
          <h3>{fecha(d)}</h3>
          <ul className="lista-simple sin-vinetas">
            {lista.map((e) => (
              <li key={e.id} className={e.resultado === 'denegado' ? 'error' : ''}>
                {hora(e.fecha_hora)} · {e.tipo === 'entrada' ? '➡️' : '⬅️'}{' '}
                {e.personas ? nombreCompleto(e.personas) : `${e.pases_dia?.nombre_invitado ?? '?'} (invitado)`}
                {e.resultado === 'denegado' && ` · no pudo entrar: ${e.motivo}`}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

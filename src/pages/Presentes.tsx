import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ok, useConsulta } from '../lib/datos';
import { PARENTESCOS, edad, hora, nombreCompleto, normalizar } from '../lib/formato';
import type { Persona } from '../lib/tipos';
import { Foto } from '../components/Foto';

interface Presente {
  persona_id: number | null;
  pase_id: number | null;
  desde: string;
}

export function Presentes() {
  const [busqueda, setBusqueda] = useState('');
  const { datos, recargar, cargando } = useConsulta(async () => {
    const lista = ok(await supabase.rpc('presentes')) as Presente[];
    const idsP = lista.flatMap((x) => (x.persona_id ? [x.persona_id] : []));
    const idsI = lista.flatMap((x) => (x.pase_id ? [x.pase_id] : []));
    const [personas, pases] = await Promise.all([
      idsP.length ? supabase.from('personas').select('*, socios(numero)').in('id', idsP).then(ok) : [],
      idsI.length ? supabase.from('pases_dia').select('id, nombre_invitado, socios(numero)').in('id', idsI).then(ok) : [],
    ]);
    const mapaP = new Map((personas as (Persona & { socios: { numero: number } })[]).map((p) => [p.id, p]));
    const mapaI = new Map((pases as { id: number; nombre_invitado: string; socios: { numero: number } }[]).map((p) => [p.id, p]));
    return lista
      .map((x) => {
        const p = x.persona_id ? mapaP.get(x.persona_id) : undefined;
        const i = x.pase_id ? mapaI.get(x.pase_id) : undefined;
        return {
          clave: `${x.persona_id}-${x.pase_id}`,
          desde: x.desde,
          nombre: p ? nombreCompleto(p) : (i?.nombre_invitado ?? '?'),
          detalle: p
            ? `${PARENTESCOS[p.parentesco]}${edad(p.fecha_nacimiento) != null ? ` · ${edad(p.fecha_nacimiento)} años` : ''} · nº ${p.socios.numero}`
            : `Invitado · socio nº ${i?.socios.numero}`,
          foto: p?.foto_path ?? null,
          invitado: !p,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  });

  const lista = useMemo(
    () => (datos ?? []).filter((x) => normalizar(x.nombre).includes(normalizar(busqueda))),
    [datos, busqueda],
  );

  return (
    <div className="pila">
      <div className="fila espaciada">
        <h2>Dentro ahora: {datos?.length ?? '–'}</h2>
        <button className="boton boton-secundario" onClick={recargar} disabled={cargando}>
          ↻
        </button>
      </div>
      <p className="tenue">
        Cuenta a quien ha entrado hoy y no ha registrado la salida. Cada día empieza de cero.
      </p>
      <input type="search" placeholder="Buscar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      <ul className="lista">
        {lista.map((x) => (
          <li key={x.clave} className="fila-socio">
            {x.invitado ? (
              <div className="foto foto-invitado" style={{ width: 40, height: 50 }}>
                🎟️
              </div>
            ) : (
              <Foto path={x.foto} nombre={x.nombre} tamano={40} />
            )}
            <div className="crece">
              <strong>{x.nombre}</strong>
              <small>{x.detalle}</small>
            </div>
            <span className="tenue">{hora(x.desde)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

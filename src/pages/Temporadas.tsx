import { useState, type FormEvent } from 'react';
import { mensajeError, supabase } from '../lib/supabase';
import { ok, useConsulta } from '../lib/datos';
import { euros, fecha } from '../lib/formato';
import type { Temporada } from '../lib/tipos';
import { Modal } from '../components/Modal';

export function Temporadas() {
  const [editando, setEditando] = useState<Temporada | 'nueva' | null>(null);
  const [error, setError] = useState('');
  const { datos, recargar } = useConsulta(
    async () => ok(await supabase.from('temporadas').select('*').order('fecha_inicio', { ascending: false })) as Temporada[],
  );

  async function activar(t: Temporada) {
    setError('');
    const { error } = await supabase.rpc('activar_temporada', { p_id: t.id });
    if (error) setError(mensajeError(error));
    recargar();
  }

  return (
    <div className="pila">
      <div className="fila espaciada">
        <h2>Temporadas</h2>
        <button className="boton" onClick={() => setEditando('nueva')}>
          + Temporada
        </button>
      </div>
      <p className="tenue">
        Solo se puede entrar con la temporada activa y dentro de sus fechas. Las cuotas se marcan como pagadas en la
        ficha de cada socio.
      </p>
      {error && <p className="error">{error}</p>}
      {datos?.map((t) => (
        <article key={t.id} className={`tarjeta ${t.activa ? 'temporada-activa' : ''}`}>
          <div className="fila espaciada">
            <div>
              <strong>{t.nombre}</strong> {t.activa && <span className="etiqueta">Activa</span>}
              <p className="tenue">
                {fecha(t.fecha_inicio)} – {fecha(t.fecha_fin)} · {t.max_pases_por_socio} invitados por socio ·{' '}
                {t.precio_pase > 0 ? `pase ${euros(t.precio_pase)}` : 'pase gratis'}
                {t.aforo_maximo ? ` · aforo ${t.aforo_maximo}` : ''}
              </p>
            </div>
          </div>
          <div className="acciones">
            {!t.activa && (
              <button className="boton" onClick={() => activar(t)}>
                Activar
              </button>
            )}
            <button className="boton boton-secundario" onClick={() => setEditando(t)}>
              Editar
            </button>
          </div>
        </article>
      ))}
      {editando && (
        <Modal titulo={editando === 'nueva' ? 'Nueva temporada' : `Temporada ${editando.nombre}`} onCerrar={() => setEditando(null)}>
          <FormTemporada
            t={editando === 'nueva' ? null : editando}
            onGuardado={() => {
              setEditando(null);
              recargar();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function FormTemporada({ t, onGuardado }: { t: Temporada | null; onGuardado: () => void }) {
  const año = new Date().getFullYear() + (new Date().getMonth() > 8 ? 1 : 0);
  const [c, setC] = useState({
    nombre: t?.nombre ?? `Verano ${año}`,
    fecha_inicio: t?.fecha_inicio ?? `${año}-06-15`,
    fecha_fin: t?.fecha_fin ?? `${año}-09-15`,
    max_pases_por_socio: String(t?.max_pases_por_socio ?? 10),
    precio_pase: String(t?.precio_pase ?? 0),
    aforo_maximo: t?.aforo_maximo ? String(t.aforo_maximo) : '',
  });
  const [error, setError] = useState('');
  const cambiar = (k: keyof typeof c, v: string) => setC((x) => ({ ...x, [k]: v }));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const datos = {
      nombre: c.nombre.trim(),
      fecha_inicio: c.fecha_inicio,
      fecha_fin: c.fecha_fin,
      max_pases_por_socio: Number(c.max_pases_por_socio),
      precio_pase: Number(c.precio_pase || 0),
      aforo_maximo: c.aforo_maximo ? Number(c.aforo_maximo) : null,
    };
    try {
      ok(
        t
          ? await supabase.from('temporadas').update(datos).eq('id', t.id).select()
          : await supabase.from('temporadas').insert(datos).select(),
      );
      onGuardado();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <form className="formulario" onSubmit={guardar}>
      <label>
        Nombre
        <input value={c.nombre} onChange={(e) => cambiar('nombre', e.target.value)} required />
      </label>
      <div className="fila">
        <label>
          Apertura
          <input type="date" value={c.fecha_inicio} onChange={(e) => cambiar('fecha_inicio', e.target.value)} required />
        </label>
        <label>
          Cierre
          <input type="date" value={c.fecha_fin} onChange={(e) => cambiar('fecha_fin', e.target.value)} required />
        </label>
      </div>
      <div className="fila">
        <label>
          Invitados por socio
          <input type="number" min={0} value={c.max_pases_por_socio} onChange={(e) => cambiar('max_pases_por_socio', e.target.value)} required />
        </label>
        <label>
          Precio del pase (€)
          <input type="number" min={0} step="0.5" value={c.precio_pase} onChange={(e) => cambiar('precio_pase', e.target.value)} />
        </label>
      </div>
      <label>
        Aforo máximo (vacío = sin límite)
        <input type="number" min={1} value={c.aforo_maximo} onChange={(e) => cambiar('aforo_maximo', e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="boton boton-grande">Guardar</button>
    </form>
  );
}

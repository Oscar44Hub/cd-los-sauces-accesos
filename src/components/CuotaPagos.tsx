import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { mensajeError, supabase } from '../lib/supabase';
import { ok, useConsulta } from '../lib/datos';
import { METODOS_PAGO, TARIFAS, euros, fecha, hoyISO } from '../lib/formato';
import type { Cuota, Pago, Socio, Tarifa, TarifaTemporada, Temporada } from '../lib/tipos';

export type CuotaConPagos = Cuota & { pagos: Pago[] };

export function totalPagado(c: CuotaConPagos | undefined): number {
  return c ? c.pagos.reduce((n, p) => n + Number(p.importe), 0) : 0;
}

export function tarifaDe(s: Pick<Socio, 'tarifa' | 'tipo'>): Tarifa {
  return s.tarifa ?? s.tipo;
}

/** Cuota de la temporada y sus pagos (solo superadmin): crear la cuota, registrar plazos, recibos */
export function CuotaPagos({ socio, temporada, cuota, onCambio }: {
  socio: Socio;
  temporada: Temporada;
  cuota: CuotaConPagos | undefined;
  onCambio: () => void;
}) {
  const pagado = totalPagado(cuota);
  const pendiente = cuota ? Math.max(0, Number(cuota.importe) - pagado) : 0;
  const [importe, setImporte] = useState('');
  const [fechaPago, setFechaPago] = useState(hoyISO());
  const [metodo, setMetodo] = useState('Efectivo');
  const [referencia, setReferencia] = useState('');
  const [nuevoImporte, setNuevoImporte] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { datos: tarifa } = useConsulta(async () => {
    const t = ok(
      await supabase.from('tarifas').select('*').eq('temporada_id', temporada.id).eq('tarifa', tarifaDe(socio)).maybeSingle(),
    ) as TarifaTemporada | null;
    return t?.importe ?? null;
  }, [temporada.id, socio.tarifa, socio.tipo]);

  async function hacer(fn: () => PromiseLike<unknown>) {
    setError('');
    try {
      await fn();
      onCambio();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  function crearCuota(e: FormEvent) {
    e.preventDefault();
    hacer(() =>
      supabase
        .from('cuotas')
        .insert({ socio_id: socio.id, temporada_id: temporada.id, importe: Number(nuevoImporte ?? tarifa ?? 0) })
        .select()
        .then(ok),
    );
    setNuevoImporte(null);
  }

  function registrarPago(e: FormEvent) {
    e.preventDefault();
    if (!cuota) return;
    hacer(() =>
      supabase
        .from('pagos')
        .insert({
          cuota_id: cuota.id,
          importe: Number(importe || pendiente),
          fecha: fechaPago,
          metodo,
          referencia: referencia.trim() || null,
        })
        .select()
        .then(ok),
    );
    setImporte('');
    setReferencia('');
  }

  if (socio.exento_cuota) {
    return (
      <section className="tarjeta cuota cuota-ok">
        <h3>Cuota {temporada.nombre}</h3>
        <p>Exento de cuota (se puede cambiar en «Editar»).</p>
      </section>
    );
  }

  if (!cuota) {
    return (
      <section className="tarjeta cuota cuota-no">
        <h3>Cuota {temporada.nombre}</h3>
        <p>Todavía no tiene cuota en esta temporada: no podrá entrar.</p>
        <form className="fila" onSubmit={crearCuota}>
          <label>
            Importe (tarifa {TARIFAS[tarifaDe(socio)].toLowerCase()})
            <input
              type="number"
              min={0}
              step="0.01"
              required
              value={nuevoImporte ?? (tarifa != null ? String(tarifa) : '')}
              onChange={(e) => setNuevoImporte(e.target.value)}
              placeholder="€"
            />
          </label>
          <button className="boton">Crear cuota</button>
        </form>
        {tarifa == null && (
          <p className="tenue">
            Consejo: define las tarifas de la temporada en <Link to="/pagos">Pagos y cuotas</Link> para que el importe se
            ponga solo.
          </p>
        )}
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  const estado = cuota.pagada ? 'Pagada' : pagado > 0 ? 'Pago parcial' : 'Pendiente';
  return (
    <section className={`tarjeta cuota ${cuota.pagada ? 'cuota-ok' : 'cuota-no'}`}>
      <div className="fila espaciada">
        <h3>Cuota {temporada.nombre}</h3>
        <span className={`estado ${cuota.pagada ? 'estado-ok' : pagado > 0 ? 'estado-parcial' : 'estado-no'}`}>{estado}</span>
      </div>
      <table className="tabla">
        <tbody>
          <tr>
            <td>
              Importe de la cuota{' '}
              {nuevoImporte == null ? (
                <button className="enlace" onClick={() => setNuevoImporte(String(cuota.importe))}>
                  (cambiar)
                </button>
              ) : null}
            </td>
            <td>
              {nuevoImporte == null ? (
                euros(cuota.importe)
              ) : (
                <form
                  className="fila"
                  onSubmit={(e) => {
                    e.preventDefault();
                    hacer(() => supabase.from('cuotas').update({ importe: Number(nuevoImporte) }).eq('id', cuota.id).select().then(ok));
                    setNuevoImporte(null);
                  }}
                >
                  <input type="number" min={0} step="0.01" value={nuevoImporte} onChange={(e) => setNuevoImporte(e.target.value)} aria-label="Nuevo importe" />
                  <button className="boton">OK</button>
                </form>
              )}
            </td>
          </tr>
          <tr>
            <td>Pagado</td>
            <td>{euros(pagado)}</td>
          </tr>
          <tr>
            <td>Pendiente</td>
            <td className={pendiente > 0 ? 'error' : ''}>{euros(pendiente)}</td>
          </tr>
        </tbody>
      </table>

      {cuota.pagos.length > 0 && (
        <ul className="lista-pagos">
          {[...cuota.pagos]
            .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id)
            .map((p) => (
              <li key={p.id}>
                <span>
                  <strong>{euros(p.importe)}</strong> · {fecha(p.fecha)} · {p.metodo}
                  {p.referencia ? ` · ${p.referencia}` : ''}
                </span>
                <span className="fila">
                  <Link className="enlace" to={`/recibo/${p.id}`}>
                    🧾 Recibo
                  </Link>
                  <button
                    className="enlace peligro"
                    onClick={() =>
                      confirm(`¿Borrar el pago de ${euros(p.importe)} del ${fecha(p.fecha)}?`) &&
                      hacer(() => supabase.from('pagos').delete().eq('id', p.id).select().then(ok))
                    }
                  >
                    Borrar
                  </button>
                </span>
              </li>
            ))}
        </ul>
      )}

      {pendiente > 0 && (
        <form className="formulario pago-nuevo" onSubmit={registrarPago}>
          <strong>Registrar pago</strong>
          <div className="fila">
            <label>
              Importe
              <input
                type="number"
                min={0.01}
                step="0.01"
                max={pendiente}
                placeholder={String(pendiente)}
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
              />
            </label>
            <label>
              Fecha
              <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} required />
            </label>
          </div>
          <div className="fila">
            <label>
              Forma de pago
              <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                {METODOS_PAGO.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              Referencia (opcional)
              <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Nº de transferencia…" />
            </label>
          </div>
          <button className="boton">
            Registrar {euros(Number(importe || pendiente))} {Number(importe || pendiente) < pendiente ? '(plazo)' : ''}
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

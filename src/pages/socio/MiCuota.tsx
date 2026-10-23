import { Link } from 'react-router-dom';
import { useSesion } from '../../auth/Sesion';
import { useConsulta } from '../../lib/datos';
import { euros, fecha } from '../../lib/formato';
import { totalPagado } from '../../components/CuotaPagos';
import { numeroRecibo } from '../Pagos';
import { miFamilia } from './datos';

/** Estado de la cuota de la familia y sus pagos, con los recibos */
export function MiCuota() {
  const { perfil } = useSesion();
  const { datos } = useConsulta(() => miFamilia(perfil!.socio_id!), [perfil?.socio_id]);
  if (!datos) return <p className="tenue">Cargando…</p>;
  const { socio, t } = datos;
  const cuotas = [...socio.cuotas].sort((a, b) => b.temporada_id - a.temporada_id);

  return (
    <div className="pila">
      <h2>Mi cuota</h2>
      {socio.exento_cuota && <p className="aviso aviso-ok">Vuestra familia está exenta de pagar cuota.</p>}
      {!socio.exento_cuota && t && !cuotas.some((c) => c.temporada_id === t.id) && (
        <p className="aviso aviso-alerta">
          La cuota {t.nombre} todavía no está emitida. Contacta con la junta del club.
        </p>
      )}
      {cuotas.map((c) => {
        const pagado = totalPagado(c);
        const pendiente = Math.max(0, Number(c.importe) - pagado);
        return (
          <section key={c.id} className={`tarjeta cuota ${c.pagada ? 'cuota-ok' : 'cuota-no'}`}>
            <div className="fila espaciada">
              <h3>Cuota {c.temporadas.nombre}</h3>
              <span className={`estado ${c.pagada ? 'estado-ok' : pagado > 0 ? 'estado-parcial' : 'estado-no'}`}>
                {c.pagada ? 'Pagada' : pagado > 0 ? 'Pago parcial' : 'Pendiente'}
              </span>
            </div>
            <table className="tabla">
              <tbody>
                <tr><td>Importe</td><td>{euros(c.importe)}</td></tr>
                <tr><td>Pagado</td><td>{euros(pagado)}</td></tr>
                {pendiente > 0 && <tr><td>Pendiente</td><td className="error">{euros(pendiente)}</td></tr>}
              </tbody>
            </table>
            {c.pagos.length > 0 && (
              <ul className="lista-pagos">
                {[...c.pagos]
                  .sort((a, b) => a.fecha.localeCompare(b.fecha))
                  .map((p) => (
                    <li key={p.id}>
                      <span>
                        <strong>{euros(p.importe)}</strong> · {fecha(p.fecha)} · {p.metodo}
                      </span>
                      <Link className="enlace" to={`/recibo/${p.id}`}>
                        🧾 Recibo {numeroRecibo(p.id)}
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
            {pendiente > 0 && (
              <p className="tenue">Para pagar lo pendiente, contacta con la junta del club o paga en la taquilla.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

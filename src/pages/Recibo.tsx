import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ok, useConsulta } from '../lib/datos';
import { TARIFAS, euros, fecha, nombreCompleto, nombreFamilia, titular } from '../lib/formato';
import type { Cuota, Pago, SocioCompleto } from '../lib/tipos';
import { tarifaDe } from '../components/CuotaPagos';
import { numeroRecibo } from './Pagos';

type PagoCompleto = Pago & {
  cuotas: Cuota & { temporadas: { nombre: string }; socios: SocioCompleto; pagos: Pago[] };
};

/** Justificante de un pago, listo para imprimir o guardar como PDF (superadmin y el propio socio) */
export function Recibo() {
  const { id } = useParams();
  const { datos: p, error } = useConsulta(
    async () =>
      ok(
        await supabase
          .from('pagos')
          .select('*, cuotas(*, temporadas(nombre), socios(*, personas(*)), pagos(*))')
          .eq('id', Number(id))
          .single(),
      ) as PagoCompleto,
    [id],
  );

  if (error) return <p className="centrado">No se encuentra el recibo.</p>;
  if (!p) return <p className="centrado">Cargando…</p>;

  const c = p.cuotas;
  const s = c.socios;
  const t = titular(s.personas);
  // Pagado hasta este recibo (incluido), para indicar lo que quedaba pendiente
  const anteriores = c.pagos.filter((x) => x.fecha < p.fecha || (x.fecha === p.fecha && x.id <= p.id));
  const pagadoHasta = anteriores.reduce((n, x) => n + Number(x.importe), 0);
  const pendiente = Math.max(0, Number(c.importe) - pagadoHasta);

  return (
    <div className="recibo-pagina">
      <div className="no-imprimir barra-impresion">
        <button className="enlace" onClick={() => history.back()}>
          ← Volver
        </button>
        <button className="boton" onClick={() => window.print()}>
          🖨️ Imprimir o guardar en PDF
        </button>
      </div>
      <article className="recibo">
        <header className="recibo-cabecera">
          <img src="./icono.svg" alt="" width={56} height={56} />
          <div>
            <strong>Club Deportivo Los Sauces</strong>
            <span>Piscina · Papatrigo (Ávila)</span>
          </div>
          <div className="recibo-numero">
            <span>RECIBO</span>
            <strong>{numeroRecibo(p.id)}</strong>
            <span>{fecha(p.fecha)}</span>
          </div>
        </header>
        <table className="tabla recibo-tabla">
          <tbody>
            <tr>
              <td>Recibido de</td>
              <td>
                <strong>{nombreFamilia(s)}</strong>
                {t && s.tipo === 'familiar' && <> · titular {nombreCompleto(t)}</>}
                {t?.dni && <> · DNI {t.dni}</>}
              </td>
            </tr>
            <tr>
              <td>Nº de socio</td>
              <td>{s.numero}</td>
            </tr>
            <tr>
              <td>Concepto</td>
              <td>
                Cuota de la temporada {c.temporadas.nombre} · tarifa {TARIFAS[tarifaDe(s)].toLowerCase()}
                {c.pagos.length > 1 && ' (pago fraccionado)'}
              </td>
            </tr>
            <tr>
              <td>Forma de pago</td>
              <td>
                {p.metodo}
                {p.referencia && ` · ref. ${p.referencia}`}
              </td>
            </tr>
            <tr className="recibo-importe">
              <td>Importe recibido</td>
              <td>{euros(p.importe)}</td>
            </tr>
            <tr>
              <td>Importe total de la cuota</td>
              <td>{euros(c.importe)}</td>
            </tr>
            <tr>
              <td>Pendiente tras este pago</td>
              <td>{pendiente > 0 ? euros(pendiente) : 'Nada: cuota pagada'}</td>
            </tr>
          </tbody>
        </table>
        {p.notas && <p className="tenue">{p.notas}</p>}
        <footer className="recibo-pie">
          <span>Club Deportivo Los Sauces · Papatrigo (Ávila)</span>
          <span>Recibo generado por la app de control de accesos</span>
        </footer>
      </article>
    </div>
  );
}

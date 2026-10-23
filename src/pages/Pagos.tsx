import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mensajeError, supabase } from '../lib/supabase';
import { ok, useConsulta } from '../lib/datos';
import { TARIFAS, TIPOS_SOCIO, euros, fecha, nombreFamilia, normalizar, nombreCompleto } from '../lib/formato';
import { descargarExcel } from '../lib/excel';
import type { SocioCompleto, Tarifa, TarifaTemporada, Temporada } from '../lib/tipos';
import { CuotaPagos, tarifaDe, totalPagado, type CuotaConPagos } from '../components/CuotaPagos';
import { Modal } from '../components/Modal';

type Estado = 'pagada' | 'parcial' | 'pendiente' | 'sin_cuota' | 'exento';
type Filtro = 'todas' | 'pendientes' | 'pagadas';

const ESTADOS: Record<Estado, { texto: string; clase: string }> = {
  pagada: { texto: 'Pagada', clase: 'estado-ok' },
  parcial: { texto: 'Parcial', clase: 'estado-parcial' },
  pendiente: { texto: 'Pendiente', clase: 'estado-no' },
  sin_cuota: { texto: 'Sin cuota', clase: 'estado-no' },
  exento: { texto: 'Exento', clase: 'estado-ok' },
};

/** Espacio del superadmin: tarifas, cuotas de la temporada, pagos, resumen y exportación */
export function Pagos() {
  const [params] = useSearchParams();
  const [temporadaId, setTemporadaId] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<number | null>(params.get('socio') ? Number(params.get('socio')) : null);
  const [aviso, setAviso] = useState('');

  const { datos: temporadas } = useConsulta(
    async () => ok(await supabase.from('temporadas').select('*').order('fecha_inicio', { ascending: false })) as Temporada[],
  );
  useEffect(() => {
    if (temporadas && temporadaId == null && temporadas.length) {
      setTemporadaId((temporadas.find((t) => t.activa) ?? temporadas[0]).id);
    }
  }, [temporadas, temporadaId]);
  const temporada = temporadas?.find((t) => t.id === temporadaId) ?? null;

  const { datos, recargar, cargando } = useConsulta(async () => {
    if (temporadaId == null) return null;
    const [socios, cuotas, tarifas] = await Promise.all([
      supabase.from('socios').select('*, personas(*)').eq('activo', true).order('numero').then(ok<SocioCompleto[]>),
      supabase.from('cuotas').select('*, pagos(*)').eq('temporada_id', temporadaId).then(ok<CuotaConPagos[]>),
      supabase.from('tarifas').select('*').eq('temporada_id', temporadaId).then(ok<TarifaTemporada[]>),
    ]);
    const porSocio = new Map(cuotas.map((c) => [c.socio_id, c]));
    const filas = socios.map((s) => {
      const cuota = porSocio.get(s.id);
      const pagado = totalPagado(cuota);
      const importe = cuota ? Number(cuota.importe) : 0;
      const estado: Estado = s.exento_cuota
        ? 'exento'
        : !cuota
          ? 'sin_cuota'
          : cuota.pagada
            ? 'pagada'
            : pagado > 0
              ? 'parcial'
              : 'pendiente';
      return { socio: s, cuota, pagado, importe, pendiente: Math.max(0, importe - pagado), estado };
    });
    return { filas, tarifas };
  }, [temporadaId]);

  const resumen = useMemo(() => {
    const f = datos?.filas ?? [];
    const contar = (e: Estado) => f.filter((x) => x.estado === e).length;
    return {
      previsto: f.reduce((n, x) => n + x.importe, 0),
      cobrado: f.reduce((n, x) => n + x.pagado, 0),
      pendiente: f.reduce((n, x) => n + x.pendiente, 0),
      pagadas: contar('pagada'),
      parciales: contar('parcial'),
      pendientes: contar('pendiente'),
      sinCuota: contar('sin_cuota'),
      exentos: contar('exento'),
    };
  }, [datos]);

  const lista = useMemo(() => {
    const q = normalizar(busqueda);
    return (datos?.filas ?? []).filter((x) => {
      if (filtro === 'pendientes' && !['pendiente', 'parcial', 'sin_cuota'].includes(x.estado)) return false;
      if (filtro === 'pagadas' && !['pagada', 'exento'].includes(x.estado)) return false;
      if (!q) return true;
      return (
        String(x.socio.numero) === q ||
        normalizar(nombreFamilia(x.socio)).includes(q) ||
        x.socio.personas.some((p) => normalizar(nombreCompleto(p)).includes(q))
      );
    });
  }, [datos, filtro, busqueda]);

  function exportarCuotas() {
    if (!datos || !temporada) return;
    descargarExcel(
      `cuotas-${temporada.nombre}`,
      ['Nº socio', 'Familia', 'Tipo', 'Tarifa', 'Importe', 'Pagado', 'Pendiente', 'Estado', 'Último pago', 'Forma de pago', 'Teléfono', 'Email'],
      datos.filas.map((x) => {
        const ultimo = [...(x.cuota?.pagos ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
        return [
          x.socio.numero,
          nombreFamilia(x.socio),
          TIPOS_SOCIO[x.socio.tipo],
          TARIFAS[tarifaDe(x.socio)],
          x.importe,
          x.pagado,
          x.pendiente,
          ESTADOS[x.estado].texto,
          ultimo ? fecha(ultimo.fecha) : '',
          ultimo?.metodo ?? '',
          x.socio.telefono,
          x.socio.email,
        ];
      }),
    );
  }

  function exportarPagos() {
    if (!datos || !temporada) return;
    const pagos = datos.filas.flatMap((x) => (x.cuota?.pagos ?? []).map((p) => ({ p, x })));
    pagos.sort((a, b) => a.p.fecha.localeCompare(b.p.fecha) || a.p.id - b.p.id);
    descargarExcel(
      `pagos-${temporada.nombre}`,
      ['Nº recibo', 'Fecha', 'Nº socio', 'Familia', 'Importe', 'Forma de pago', 'Referencia', 'Notas'],
      pagos.map(({ p, x }) => [numeroRecibo(p.id), fecha(p.fecha), x.socio.numero, nombreFamilia(x.socio), p.importe, p.metodo, p.referencia, p.notas]),
    );
  }

  async function generar() {
    if (!temporada) return;
    try {
      const r = ok(await supabase.rpc('generar_cuotas', { p_temporada: temporada.id })) as { creadas: number; sin_tarifa: number };
      setAviso(
        `${r.creadas} cuota${r.creadas === 1 ? '' : 's'} creada${r.creadas === 1 ? '' : 's'}.` +
          (r.sin_tarifa ? ` ${r.sin_tarifa} socios siguen sin cuota porque falta su tarifa.` : ''),
      );
      recargar();
    } catch (e) {
      setAviso(mensajeError(e));
    }
  }

  const fila = abierto != null ? datos?.filas.find((x) => x.socio.id === abierto) : undefined;

  return (
    <div className="pila">
      <div className="fila espaciada">
        <h2>Pagos y cuotas</h2>
        {temporadas && temporadas.length > 1 && (
          <select value={temporadaId ?? ''} onChange={(e) => setTemporadaId(Number(e.target.value))} aria-label="Temporada" style={{ width: 'auto' }}>
            {temporadas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        )}
      </div>
      {temporadas && !temporadas.length && <p className="aviso aviso-alerta">Crea primero una temporada.</p>}

      {datos && (
        <>
          <div className="cifras">
            <div className="tarjeta"><strong>{euros(resumen.cobrado)}</strong><span>cobrado</span></div>
            <div className="tarjeta"><strong className={resumen.pendiente ? 'error' : ''}>{euros(resumen.pendiente)}</strong><span>pendiente</span></div>
            <div className="tarjeta"><strong>{euros(resumen.previsto)}</strong><span>previsto</span></div>
          </div>
          <p className="tenue centrado-texto">
            {resumen.pagadas} pagadas · {resumen.parciales} con pago parcial · {resumen.pendientes} pendientes ·{' '}
            {resumen.sinCuota} sin cuota · {resumen.exentos} exentos
          </p>

          <Tarifas temporadaId={temporadaId!} tarifas={datos.tarifas} onGuardado={recargar} />

          {resumen.sinCuota > 0 && (
            <div className="aviso aviso-alerta">
              {resumen.sinCuota} socios activos todavía no tienen cuota en esta temporada y no podrán entrar.{' '}
              <button className="boton" onClick={generar}>
                Generar sus cuotas según la tarifa
              </button>
            </div>
          )}

          <div className="fila">
            <button className="boton boton-secundario" onClick={exportarCuotas}>
              ⬇️ Excel de cuotas
            </button>
            <button className="boton boton-secundario" onClick={exportarPagos}>
              ⬇️ Excel de pagos
            </button>
          </div>

          <input type="search" placeholder="Buscar familia, persona o nº de socio" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar" />
          <div className="segmentado pequeno">
            {([['todas', 'Todas'], ['pendientes', 'Por cobrar'], ['pagadas', 'Pagadas']] as [Filtro, string][]).map(([v, t]) => (
              <button key={v} className={filtro === v ? 'activo' : ''} onClick={() => setFiltro(v)}>
                {t}
              </button>
            ))}
          </div>

          <ul className="lista">
            {lista.map((x) => (
              <li key={x.socio.id}>
                <button className="fila-socio fila-boton" onClick={() => setAbierto(x.socio.id)}>
                  <div>
                    <strong>{nombreFamilia(x.socio)}</strong>
                    <small>
                      Nº {x.socio.numero} · {TARIFAS[tarifaDe(x.socio)]}
                      {x.cuota && ` · ${euros(x.pagado)} de ${euros(x.importe)}`}
                    </small>
                  </div>
                  <span className={`estado ${ESTADOS[x.estado].clase}`}>{ESTADOS[x.estado].texto}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {cargando && !datos && <p className="tenue">Cargando…</p>}

      {fila && temporada && (
        <Modal titulo={`${nombreFamilia(fila.socio)} · nº ${fila.socio.numero}`} onCerrar={() => setAbierto(null)}>
          <CuotaPagos socio={fila.socio} temporada={temporada} cuota={fila.cuota} onCambio={recargar} />
        </Modal>
      )}
      {aviso && (
        <div className="toast" onClick={() => setAviso('')}>
          {aviso}
        </div>
      )}
    </div>
  );
}

export function numeroRecibo(id: number): string {
  return `R-${String(id).padStart(5, '0')}`;
}

function Tarifas({ temporadaId, tarifas, onGuardado }: { temporadaId: number; tarifas: TarifaTemporada[]; onGuardado: () => void }) {
  const inicial = () =>
    Object.fromEntries((Object.keys(TARIFAS) as Tarifa[]).map((k) => [k, String(tarifas.find((t) => t.tarifa === k)?.importe ?? '')]));
  const [valores, setValores] = useState<Record<string, string>>(inicial);
  const [abierto, setAbierto] = useState(tarifas.length === 0);
  const [error, setError] = useState('');
  useEffect(() => setValores(inicial()), [tarifas]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    const filas = Object.entries(valores)
      .filter(([, v]) => v !== '')
      .map(([tarifa, v]) => ({ temporada_id: temporadaId, tarifa, importe: Number(v) }));
    try {
      ok(await supabase.from('tarifas').upsert(filas, { onConflict: 'temporada_id,tarifa' }).select());
      const vacias = Object.entries(valores).filter(([, v]) => v === '').map(([k]) => k);
      if (vacias.length) ok(await supabase.from('tarifas').delete().eq('temporada_id', temporadaId).in('tarifa', vacias).select());
      setAbierto(false);
      onGuardado();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <details className="tarjeta" open={abierto} onToggle={(e) => setAbierto((e.target as HTMLDetailsElement).open)}>
      <summary>
        <strong>Tarifas de la temporada</strong>{' '}
        <span className="tenue">
          {tarifas.length
            ? tarifas.map((t) => `${TARIFAS[t.tarifa]} ${euros(t.importe)}`).join(' · ')
            : 'sin definir'}
        </span>
      </summary>
      <form className="formulario" onSubmit={guardar}>
        <p className="tenue">
          Cada socio paga la tarifa de su tipo (familiar o individual), salvo que en su ficha se le asigne otra (por
          ejemplo, jubilado o fundador). Deja vacía la que no uséis.
        </p>
        <div className="fila">
          {(Object.keys(TARIFAS) as Tarifa[]).map((k) => (
            <label key={k}>
              {TARIFAS[k]} (€)
              <input
                type="number"
                min={0}
                step="0.01"
                value={valores[k]}
                onChange={(e) => setValores((v) => ({ ...v, [k]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
        <button className="boton">Guardar tarifas</button>
      </form>
    </details>
  );
}

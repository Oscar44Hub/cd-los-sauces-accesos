import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ok, temporadaActiva, useConsulta } from '../lib/datos';
import { PARENTESCOS, fecha, hoyISO, sumarDias } from '../lib/formato';
import type { Parentesco, SocioCompleto } from '../lib/tipos';

interface Est {
  por_dia: { dia: string; socios: number; invitados: number }[];
  total_visitas: number;
  personas_distintas: number;
  invitados: number;
  por_parentesco: Partial<Record<Parentesco, number>>;
  jubilados: number;
  fundadores: number;
  denegados: number;
  motivos_denegacion: Record<string, number>;
  por_hora: Record<string, number>;
}

type Periodo = 'hoy' | '7' | '30' | 'temporada';

export function Estadisticas() {
  const [periodo, setPeriodo] = useState<Periodo>('7');
  const { datos } = useConsulta(async () => {
    const t = await temporadaActiva();
    const hoy = hoyISO();
    const desde =
      periodo === 'hoy' ? hoy : periodo === '7' ? sumarDias(hoy, -6) : periodo === '30' ? sumarDias(hoy, -29) : (t?.fecha_inicio ?? sumarDias(hoy, -29));
    const hasta = periodo === 'temporada' && t ? (t.fecha_fin < hoy ? t.fecha_fin : hoy) : hoy;
    const [est, socios] = await Promise.all([
      supabase.rpc('estadisticas', { p_desde: desde, p_hasta: hasta }).then(ok<Est>),
      supabase.from('socios').select('*, personas(id, activo, es_jubilado, es_fundador), cuotas(*)').eq('activo', true).then(ok<SocioCompleto[]>),
    ]);
    const pagados = socios.filter((s) => s.exento_cuota || s.cuotas.some((c) => c.temporada_id === t?.id && c.pagada));
    const recaudado = socios.reduce(
      (n, s) => n + s.cuotas.filter((c) => c.temporada_id === t?.id && c.pagada).reduce((m, c) => m + Number(c.importe), 0),
      0,
    );
    const personas = socios.flatMap((s) => s.personas.filter((p) => p.activo));
    return {
      est, desde, hasta, t,
      censo: {
        socios: socios.length,
        familiares: socios.filter((s) => s.tipo === 'familiar').length,
        individuales: socios.filter((s) => s.tipo === 'individual').length,
        personas: personas.length,
        jubilados: personas.filter((p) => p.es_jubilado).length,
        fundadores: personas.filter((p) => p.es_fundador).length,
        pagados: pagados.length,
        recaudado,
      },
    };
  }, [periodo]);

  const e = datos?.est;
  const maxDia = Math.max(1, ...(e?.por_dia.map((d) => d.socios + d.invitados) ?? [1]));
  const horas = Array.from({ length: 15 }, (_, i) => i + 9); // 9:00 a 23:00
  const maxHora = Math.max(1, ...horas.map((h) => e?.por_hora[h] ?? 0));

  return (
    <div className="pila">
      <h2>Estadísticas</h2>
      <div className="segmentado pequeno">
        {([['hoy', 'Hoy'], ['7', '7 días'], ['30', '30 días'], ['temporada', 'Temporada']] as [Periodo, string][]).map(([v, t]) => (
          <button key={v} className={periodo === v ? 'activo' : ''} onClick={() => setPeriodo(v)}>
            {t}
          </button>
        ))}
      </div>
      {datos && (
        <p className="tenue">
          Del {fecha(datos.desde)} al {fecha(datos.hasta)}
        </p>
      )}

      <div className="cifras">
        <div className="tarjeta"><strong>{e?.total_visitas ?? '–'}</strong><span>visitas</span></div>
        <div className="tarjeta"><strong>{e?.personas_distintas ?? '–'}</strong><span>socios distintos</span></div>
        <div className="tarjeta"><strong>{e?.invitados ?? '–'}</strong><span>invitados</span></div>
      </div>

      {e && e.por_dia.length > 1 && (
        <section className="tarjeta">
          <h3>Visitas por día</h3>
          <div className="grafico-barras" role="img" aria-label="Visitas por día">
            {e.por_dia.map((d, i) => (
              <div key={d.dia} className="barra-dia" title={`${fecha(d.dia)}: ${d.socios} socios, ${d.invitados} invitados`}>
                {/* Con muchos días no caben las cifras ni todas las fechas */}
                {e.por_dia.length <= 14 && <span className="valor">{d.socios + d.invitados}</span>}
                <div className="pila-barra" style={{ height: `${((d.socios + d.invitados) / maxDia) * 100}%` }}>
                  <div className="b-invitados" style={{ flex: d.invitados }} />
                  <div className="b-socios" style={{ flex: d.socios }} />
                </div>
                <span className="eje">{e.por_dia.length <= 14 || i % 5 === 0 ? d.dia.slice(8) : '\u00a0'}</span>
              </div>
            ))}
          </div>
          <p className="leyenda">
            <span className="punto b-socios" /> Socios <span className="punto b-invitados" /> Invitados
          </p>
        </section>
      )}

      {e && e.total_visitas > 0 && (
        <section className="tarjeta">
          <h3>Horas de más afluencia</h3>
          <div className="grafico-barras horas">
            {horas.map((h) => (
              <div key={h} className="barra-dia" title={`${h}:00 · ${e.por_hora[h] ?? 0} entradas`}>
                <div className="pila-barra" style={{ height: `${((e.por_hora[h] ?? 0) / maxHora) * 100}%` }}>
                  <div className="b-socios" style={{ flex: 1 }} />
                </div>
                <span className="eje">{h}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {e && (
        <section className="tarjeta">
          <h3>Quién viene</h3>
          <table className="tabla">
            <tbody>
              {Object.entries(PARENTESCOS).map(([k, t]) => (
                <tr key={k}>
                  <td>{t}</td>
                  <td>{e.por_parentesco[k as Parentesco] ?? 0}</td>
                </tr>
              ))}
              <tr><td>Invitados</td><td>{e.invitados}</td></tr>
              <tr className="separador"><td>De ellos, jubilados</td><td>{e.jubilados}</td></tr>
              <tr><td>De ellos, fundadores</td><td>{e.fundadores}</td></tr>
            </tbody>
          </table>
        </section>
      )}

      {e && e.denegados > 0 && (
        <section className="tarjeta">
          <h3>Entradas rechazadas: {e.denegados}</h3>
          <table className="tabla">
            <tbody>
              {Object.entries(e.motivos_denegacion)
                .sort((a, b) => b[1] - a[1])
                .map(([m, n]) => (
                  <tr key={m}><td>{m}</td><td>{n}</td></tr>
                ))}
            </tbody>
          </table>
        </section>
      )}

      {datos && (
        <section className="tarjeta">
          <h3>Censo del club {datos.t ? `· ${datos.t.nombre}` : ''}</h3>
          <table className="tabla">
            <tbody>
              <tr><td>Socios activos</td><td>{datos.censo.socios}</td></tr>
              <tr><td>· Familiares / individuales</td><td>{datos.censo.familiares} / {datos.censo.individuales}</td></tr>
              <tr><td>Personas con carnet</td><td>{datos.censo.personas}</td></tr>
              <tr><td>· Jubilados</td><td>{datos.censo.jubilados}</td></tr>
              <tr><td>· Fundadores</td><td>{datos.censo.fundadores}</td></tr>
              <tr className="separador"><td>Cuota al día (o exentos)</td><td>{datos.censo.pagados} de {datos.censo.socios}</td></tr>
              <tr><td>Recaudado en cuotas</td><td>{datos.censo.recaudado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td></tr>
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

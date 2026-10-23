import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { mensajeError, supabase } from '../lib/supabase';
import { cuotasAlDia, ok, temporadaActiva, useConsulta } from '../lib/datos';
import { PARENTESCOS, TARIFAS, TIPOS_SOCIO, edad, enlaceCarnet, etiquetas, euros, fecha, nombreCompleto, nombreFamilia } from '../lib/formato';
import { compartirEnlace, enlaceWhatsApp } from '../lib/compartir';
import { avisar } from '../lib/avisos';
import type { PaseDia, Perfil, Persona, ResultadoAcceso, SocioCompleto, Tarifa, TipoSocio } from '../lib/tipos';
import { useSesion } from '../auth/Sesion';
import { Foto } from '../components/Foto';
import { Modal } from '../components/Modal';
import { PersonaForm } from '../components/PersonaForm';
import { Qr } from '../components/Qr';
import { Resultado } from '../components/Resultado';
import { CuotaPagos, tarifaDe, type CuotaConPagos } from '../components/CuotaPagos';
import { registrarAcceso } from './Escanear';

export function SocioDetalle() {
  const { id } = useParams();
  const { esSuper } = useSesion();
  const navegar = useNavigate();
  const [editando, setEditando] = useState<Persona | 'nueva' | null>(null);
  const [verQr, setVerQr] = useState<Persona | null>(null);
  const [editarSocio, setEditarSocio] = useState(false);
  const [resultado, setResultado] = useState<ResultadoAcceso | null>(null);
  const [aviso, setAviso] = useState('');

  const { datos, error, recargar } = useConsulta(async () => {
    const t = await temporadaActiva();
    const s = ok(
      await supabase.from('socios').select('*, personas(*), cuotas(*, pagos(*))').eq('id', Number(id)).single(),
    ) as Omit<SocioCompleto, 'cuotas'> & { cuotas: CuotaConPagos[] };
    s.personas.sort((a, b) => ordenParentesco(a) - ordenParentesco(b) || (a.fecha_nacimiento ?? '').localeCompare(b.fecha_nacimiento ?? ''));
    const pases = t
      ? (ok(await supabase.from('pases_dia').select('*').eq('socio_id', s.id).eq('temporada_id', t.id).order('fecha', { ascending: false })) as PaseDia[])
      : [];
    const alDia = (await cuotasAlDia()).get(s.id) ?? false;
    // Cuentas de socio vinculadas a esta familia (solo las ve el superadmin)
    const cuentas = esSuper ? (ok(await supabase.from('perfiles').select('*').eq('socio_id', s.id)) as Perfil[]) : [];
    return { t, s, pases, alDia, cuentas };
  }, [id, esSuper]);

  if (error) return <p className="error">{mensajeError(error)}</p>;
  if (!datos) return <p className="tenue">Cargando…</p>;
  const { s, t, pases, alDia, cuentas } = datos;
  const cuota = s.cuotas.find((c) => c.temporada_id === t?.id);

  async function accion(fn: () => PromiseLike<unknown>, mensaje?: string) {
    try {
      await fn();
      if (mensaje) setAviso(mensaje);
      await recargar();
    } catch (e) {
      setAviso(mensajeError(e));
    }
  }

  async function entrar(p: Persona) {
    try {
      const r = await registrarAcceso(p.codigo_qr, 'entrada');
      avisar(r.resultado === 'autorizado');
      setResultado(r);
    } catch (e) {
      setAviso(mensajeError(e));
    }
  }

  async function compartir(p: Persona) {
    const r = await compartirEnlace(
      'Carnet CD Los Sauces',
      `Carnet de socio de ${nombreCompleto(p)} (CD Los Sauces). Enséñalo en la entrada de la piscina:`,
      enlaceCarnet(p.codigo_qr),
    );
    if (r === 'copiado') setAviso('Enlace del carnet copiado');
  }

  return (
    <div className="pila">
      <Link to="/socios" className="enlace">
        ← Familias
      </Link>

      <section className="tarjeta">
        <div className="fila espaciada">
          <div>
            <h2>{nombreFamilia(s)}</h2>
            <p className="tenue">
              Socio nº {s.numero} · {TIPOS_SOCIO[s.tipo]}
              {esSuper && !s.exento_cuota && ` · Tarifa ${TARIFAS[tarifaDe(s)].toLowerCase()}`}
              {s.exento_cuota && ' · Exento de cuota'}
              {!s.activo && ' · DADO DE BAJA'}
            </p>
          </div>
          {esSuper && (
            <button className="boton boton-secundario" onClick={() => setEditarSocio(true)}>
              Editar
            </button>
          )}
        </div>
        {(s.telefono || s.email || s.direccion) && (
          <p className="tenue">
            {[s.telefono, s.email, s.direccion].filter(Boolean).join(' · ')}
          </p>
        )}
        {s.observaciones && <p>📝 {s.observaciones}</p>}
        {esSuper && (
          <p className="tenue">
            👤 Cuentas en la app:{' '}
            {cuentas.length ? cuentas.map((c) => c.email).join(', ') : 'ninguna'} ·{' '}
            <Link to="/usuarios">gestionar</Link>
          </p>
        )}
      </section>

      {t && esSuper && <CuotaPagos socio={s} temporada={t} cuota={cuota} onCambio={recargar} />}
      {t && !esSuper && (
        <section className={`tarjeta cuota ${alDia ? 'cuota-ok' : 'cuota-no'}`}>
          <div className="fila espaciada">
            <div>
              <h3>Cuota {t.nombre}</h3>
              <p>{s.exento_cuota ? 'Exento de cuota' : alDia ? 'Al día' : 'Pendiente de pago: no podrán entrar'}</p>
            </div>
            <strong className="cuota-icono">{alDia ? '✔' : '!'}</strong>
          </div>
        </section>
      )}

      <section className="pila">
        <div className="fila espaciada">
          <h3>Personas ({s.personas.length})</h3>
          <div className="fila">
            {esSuper && s.personas.length > 0 && (
              <Link className="boton boton-secundario" to={`/imprimir?ids=${s.personas.map((p) => p.id).join(',')}`}>
                🖨️ Carnets
              </Link>
            )}
            {esSuper && (s.tipo === 'familiar' || s.personas.length === 0) && (
              <button className="boton" onClick={() => setEditando('nueva')}>
                + Persona
              </button>
            )}
          </div>
        </div>

        {s.personas.length === 0 && <p className="tenue">Añade al titular y al resto de la familia.</p>}

        {s.personas.map((p) => {
          const e = edad(p.fecha_nacimiento);
          return (
            <article key={p.id} className={`tarjeta persona ${p.activo ? '' : 'inactiva'}`}>
              <div className="fila">
                <Foto path={p.foto_path} nombre={nombreCompleto(p)} tamano={64} />
                <div className="crece">
                  <strong>{nombreCompleto(p)}</strong>
                  <p className="tenue">
                    {PARENTESCOS[p.parentesco]}
                    {e != null && ` · ${e} años`}
                  </p>
                  <div className="etiquetas">
                    {etiquetas({ ...p, edad: e }).map((x) => (
                      <span key={x} className="etiqueta">
                        {x}
                      </span>
                    ))}
                    {p.estado_tarjeta !== 'activa' && <span className="etiqueta etiqueta-no">Tarjeta {p.estado_tarjeta}</span>}
                    {!p.activo && <span className="etiqueta etiqueta-no">Baja</span>}
                  </div>
                </div>
              </div>
              <div className="acciones">
                <button className="boton" onClick={() => entrar(p)}>
                  ➡️ Registrar entrada
                </button>
                <button className="boton boton-secundario" onClick={() => setVerQr(p)}>
                  QR
                </button>
                <button className="boton boton-secundario" onClick={() => compartir(p)}>
                  📲 Carnet digital
                </button>
                {esSuper && (
                  <>
                    <button className="boton boton-secundario" onClick={() => setEditando(p)}>
                      Editar
                    </button>
                    <details className="mas">
                      <summary className="boton boton-secundario">⋯</summary>
                      <div>
                        <button
                          className="enlace"
                          onClick={() =>
                            confirm(
                              `¿Tarjeta perdida? Se generará un QR nuevo para ${p.nombre} y el carnet antiguo (impreso o digital) dejará de funcionar.`,
                            ) &&
                            accion(
                              () =>
                                supabase
                                  .from('personas')
                                  .update({ codigo_qr: crypto.randomUUID(), estado_tarjeta: 'activa' })
                                  .eq('id', p.id)
                                  .then(ok),
                              'QR nuevo generado. Imprime o envía el carnet otra vez.',
                            )
                          }
                        >
                          🔄 Tarjeta perdida: nuevo QR
                        </button>
                        <button
                          className="enlace"
                          onClick={() =>
                            accion(() =>
                              supabase
                                .from('personas')
                                .update({ estado_tarjeta: p.estado_tarjeta === 'bloqueada' ? 'activa' : 'bloqueada' })
                                .eq('id', p.id)
                                .then(ok),
                            )
                          }
                        >
                          {p.estado_tarjeta === 'bloqueada' ? '🔓 Desbloquear tarjeta' : '🔒 Bloquear tarjeta'}
                        </button>
                        <button
                          className="enlace"
                          onClick={() =>
                            accion(() => supabase.from('personas').update({ activo: !p.activo }).eq('id', p.id).then(ok))
                          }
                        >
                          {p.activo ? 'Dar de baja' : 'Reactivar'}
                        </button>
                        <button
                          className="enlace peligro"
                          onClick={() =>
                            confirm(`¿Borrar a ${nombreCompleto(p)} definitivamente? Se perderá su historial de entradas.`) &&
                            accion(async () => {
                              ok(await supabase.from('personas').delete().eq('id', p.id).select());
                              if (p.foto_path) await supabase.storage.from('fotos').remove([p.foto_path]);
                            })
                          }
                        >
                          🗑️ Borrar persona
                        </button>
                      </div>
                    </details>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {t && (
        <section className="tarjeta">
          <div className="fila espaciada">
            <h3>Invitados esta temporada</h3>
            <span className="tenue">
              {pases.length} / {t.max_pases_por_socio}
            </span>
          </div>
          {pases.length === 0 ? (
            <p className="tenue">Todavía no ha traído invitados.</p>
          ) : (
            <ul className="lista-simple">
              {pases.map((x) => (
                <li key={x.id}>
                  {fecha(x.fecha)} · {x.nombre_invitado} {x.importe > 0 && `· ${euros(x.importe)} ${x.pagado ? '✔' : '(pendiente)'}`}
                </li>
              ))}
            </ul>
          )}
          <Link className="boton boton-secundario" to={`/invitados?socio=${s.numero}`}>
            🎟️ Nuevo invitado
          </Link>
        </section>
      )}

      {esSuper && (
        <button
          className="enlace peligro"
          onClick={() =>
            confirm(`¿Borrar el socio nº ${s.numero} con todas sus personas, cuotas e invitados? No se puede deshacer.`) &&
            accion(async () => {
              const fotos = s.personas.map((p) => p.foto_path).filter((x): x is string => !!x);
              ok(await supabase.from('socios').delete().eq('id', s.id).select());
              if (fotos.length) await supabase.storage.from('fotos').remove(fotos);
              navegar('/socios');
            })
          }
        >
          Borrar socio
        </button>
      )}

      {aviso && (
        <div className="toast" onClick={() => setAviso('')}>
          {aviso}
        </div>
      )}

      {editando && (
        <Modal titulo={editando === 'nueva' ? 'Nueva persona' : 'Editar persona'} onCerrar={() => setEditando(null)}>
          <PersonaForm
            socioId={s.id}
            persona={editando === 'nueva' ? null : editando}
            parentescoInicial={s.personas.some((p) => p.parentesco === 'titular') ? 'hijo' : 'titular'}
            onGuardado={() => {
              setEditando(null);
              recargar();
            }}
          />
        </Modal>
      )}

      {verQr && (
        <Modal titulo={nombreCompleto(verQr)} onCerrar={() => setVerQr(null)}>
          <div className="centrado-texto pila">
            <Qr valor={verQr.codigo_qr} tamano={260} className="qr-grande" />
            <p className="tenue">Este QR es el que lleva su tarjeta y su carnet digital.</p>
            <div className="fila">
              <button className="boton" onClick={() => compartir(verQr)}>
                📲 Enviar carnet digital
              </button>
              <a
                className="boton boton-secundario"
                href={enlaceWhatsApp(
                  `Carnet de socio de ${nombreCompleto(verQr)} (CD Los Sauces):`,
                  enlaceCarnet(verQr.codigo_qr),
                  verQr.telefono ?? s.telefono,
                )}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            </div>
          </div>
        </Modal>
      )}

      {editarSocio && (
        <Modal titulo={`Socio nº ${s.numero}`} onCerrar={() => setEditarSocio(false)}>
          <EditarSocio
            socio={s}
            onGuardado={() => {
              setEditarSocio(false);
              recargar();
            }}
          />
        </Modal>
      )}

      {resultado && <Resultado r={resultado} onCerrar={() => setResultado(null)} />}
    </div>
  );
}

function ordenParentesco(p: Persona) {
  return ['titular', 'conyuge', 'abuelo', 'hijo', 'otro'].indexOf(p.parentesco);
}

function EditarSocio({ socio, onGuardado }: { socio: SocioCompleto; onGuardado: () => void }) {
  const [c, setC] = useState({
    numero: String(socio.numero),
    tipo: socio.tipo,
    exento_cuota: socio.exento_cuota,
    tarifa: socio.tarifa ?? '',
    activo: socio.activo,
    telefono: socio.telefono ?? '',
    email: socio.email ?? '',
    direccion: socio.direccion ?? '',
    observaciones: socio.observaciones ?? '',
  });
  const [error, setError] = useState('');
  const cambiar = (k: keyof typeof c, v: string | boolean) => setC((x) => ({ ...x, [k]: v }));
  const tarifaPorTipo: Tarifa = c.tipo;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (c.tipo === 'individual' && socio.personas.length > 1) {
      setError('Un socio individual solo puede tener una persona.');
      return;
    }
    try {
      ok(
        await supabase
          .from('socios')
          .update({
            ...c,
            numero: Number(c.numero),
            tarifa: c.tarifa || null,
            telefono: c.telefono || null,
            email: c.email || null,
            direccion: c.direccion || null,
            observaciones: c.observaciones || null,
          })
          .eq('id', socio.id)
          .select(),
      );
      onGuardado();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <form className="formulario" onSubmit={guardar}>
      <div className="fila">
        <label>
          Nº de socio
          <input type="number" min={1} value={c.numero} onChange={(e) => cambiar('numero', e.target.value)} required />
        </label>
        <label>
          Tipo
          <select value={c.tipo} onChange={(e) => cambiar('tipo', e.target.value as TipoSocio)}>
            <option value="familiar">Familiar</option>
            <option value="individual">Individual</option>
          </select>
        </label>
      </div>
      <label>
        Teléfono de contacto
        <input type="tel" value={c.telefono} onChange={(e) => cambiar('telefono', e.target.value)} />
      </label>
      <label>
        Email
        <input type="email" value={c.email} onChange={(e) => cambiar('email', e.target.value)} />
      </label>
      <label>
        Dirección
        <input value={c.direccion} onChange={(e) => cambiar('direccion', e.target.value)} />
      </label>
      <label>
        Observaciones
        <textarea value={c.observaciones} onChange={(e) => cambiar('observaciones', e.target.value)} />
      </label>
      <label>
        Tarifa de la cuota
        <select value={c.tarifa} onChange={(e) => cambiar('tarifa', e.target.value)}>
          <option value="">Según el tipo ({TARIFAS[tarifaPorTipo].toLowerCase()})</option>
          {(Object.keys(TARIFAS) as Tarifa[]).map((k) => (
            <option key={k} value={k}>
              {TARIFAS[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="casilla">
        <input type="checkbox" checked={c.exento_cuota} onChange={(e) => cambiar('exento_cuota', e.target.checked)} />
        Exento de pagar cuota (socio de honor…)
      </label>
      <label className="casilla">
        <input type="checkbox" checked={c.activo} onChange={(e) => cambiar('activo', e.target.checked)} />
        Socio activo
      </label>
      {error && <p className="error">{error}</p>}
      <button className="boton boton-grande">Guardar</button>
    </form>
  );
}

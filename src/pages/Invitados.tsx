import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mensajeError, supabase } from '../lib/supabase';
import { ok, temporadaActiva, useConsulta } from '../lib/datos';
import { enlaceCarnet, euros, hoyISO, nombreCompleto } from '../lib/formato';
import { compartirEnlace } from '../lib/compartir';
import { avisar } from '../lib/avisos';
import type { PaseDia, ResultadoAcceso, SocioCompleto } from '../lib/tipos';
import { Modal } from '../components/Modal';
import { Qr } from '../components/Qr';
import { Resultado } from '../components/Resultado';
import { registrarAcceso } from './Escanear';

type PaseConSocio = PaseDia & { socios: { numero: number } };

export function Invitados() {
  const [params] = useSearchParams();
  const [numero, setNumero] = useState(params.get('socio') ?? '');
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [pagado, setPagado] = useState(true);
  const [error, setError] = useState('');
  const [creado, setCreado] = useState<PaseDia | null>(null);
  const [resultado, setResultado] = useState<ResultadoAcceso | null>(null);

  const { datos, recargar } = useConsulta(async () => {
    const t = await temporadaActiva();
    const socios = ok(await supabase.from('socios').select('*, personas(*), cuotas(*)').eq('activo', true)) as SocioCompleto[];
    const hoy = ok(
      await supabase.from('pases_dia').select('*, socios(numero)').eq('fecha', hoyISO()).order('creado_en', { ascending: false }),
    ) as PaseConSocio[];
    const usados = t
      ? (ok(await supabase.from('pases_dia').select('socio_id').eq('temporada_id', t.id)) as { socio_id: number }[])
      : [];
    return { t, socios, hoy, usados };
  });

  const socio = useMemo(() => datos?.socios.find((s) => String(s.numero) === numero.trim()), [datos, numero]);
  const usados = socio ? (datos?.usados.filter((u) => u.socio_id === socio.id).length ?? 0) : 0;
  const precio = datos?.t?.precio_pase ?? 0;
  const max = datos?.t?.max_pases_por_socio ?? 0;

  async function crear(e: FormEvent) {
    e.preventDefault();
    if (!socio) return;
    setError('');
    try {
      const p = ok(
        await supabase
          .from('pases_dia')
          .insert({
            socio_id: socio.id,
            nombre_invitado: nombre.trim(),
            dni_invitado: dni.trim().toUpperCase() || null,
            importe: precio,
            pagado: precio === 0 || pagado,
          })
          .select()
          .single(),
      ) as PaseDia;
      setCreado(p);
      setNombre('');
      setDni('');
      recargar();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  async function entrar(codigo: string) {
    try {
      const r = await registrarAcceso(codigo, 'entrada');
      avisar(r.resultado === 'autorizado');
      setCreado(null);
      setResultado(r);
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  const titular = socio?.personas.find((p) => p.parentesco === 'titular') ?? socio?.personas[0];

  return (
    <div className="pila">
      <h2>Pase de invitado (hoy)</h2>
      {datos && !datos.t && <p className="aviso aviso-alerta">No hay temporada activa.</p>}
      <form className="tarjeta formulario" onSubmit={crear}>
        <label>
          Nº del socio que invita
          <input type="number" inputMode="numeric" min={1} value={numero} onChange={(e) => setNumero(e.target.value)} required />
        </label>
        {numero && datos && (
          <p className={socio ? 'tenue' : 'error'}>
            {socio
              ? `${titular ? nombreCompleto(titular) : 'Socio'} · ha usado ${usados} de ${max} pases esta temporada`
              : 'No hay ningún socio activo con ese número'}
          </p>
        )}
        <label>
          Nombre y apellidos del invitado
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="off" />
        </label>
        <label>
          DNI del invitado (opcional)
          <input value={dni} onChange={(e) => setDni(e.target.value)} autoComplete="off" />
        </label>
        {precio > 0 && (
          <label className="casilla">
            <input type="checkbox" checked={pagado} onChange={(e) => setPagado(e.target.checked)} />
            Ha pagado {euros(precio)}
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <button className="boton boton-grande" disabled={!socio || usados >= max}>
          {socio && usados >= max ? 'Sin pases disponibles' : 'Crear pase'}
        </button>
      </form>

      <h3>Invitados de hoy ({datos?.hoy.length ?? 0})</h3>
      <ul className="lista">
        {datos?.hoy.map((p) => (
          <li key={p.id} className="fila-socio">
            <div className="crece">
              <strong>{p.nombre_invitado}</strong>
              <small>
                Socio nº {p.socios.numero}
                {p.importe > 0 && ` · ${euros(p.importe)} ${p.pagado ? 'pagado' : 'PENDIENTE'}`}
              </small>
            </div>
            {p.importe > 0 && !p.pagado && (
              <button
                className="boton boton-secundario"
                onClick={async () => {
                  await supabase.from('pases_dia').update({ pagado: true }).eq('id', p.id);
                  recargar();
                }}
              >
                Cobrado
              </button>
            )}
            <button className="boton boton-secundario" onClick={() => setCreado(p)}>
              QR
            </button>
          </li>
        ))}
      </ul>

      {creado && (
        <Modal titulo={`Pase de ${creado.nombre_invitado}`} onCerrar={() => setCreado(null)}>
          <div className="centrado-texto pila">
            <Qr valor={creado.codigo_qr} tamano={240} className="qr-grande" />
            <p className="tenue">Válido solo hoy. Puede enseñar este QR desde su móvil o entrar ahora directamente.</p>
            <button className="boton boton-grande" onClick={() => entrar(creado.codigo_qr)}>
              ➡️ Registrar entrada ahora
            </button>
            <button
              className="boton boton-secundario"
              onClick={() =>
                compartirEnlace(
                  'Pase de invitado · CD Los Sauces',
                  `Pase de invitado para ${creado.nombre_invitado} (piscina CD Los Sauces):`,
                  enlaceCarnet(creado.codigo_qr),
                )
              }
            >
              📲 Enviar pase al móvil
            </button>
          </div>
        </Modal>
      )}
      {resultado && <Resultado r={resultado} onCerrar={() => setResultado(null)} />}
    </div>
  );
}

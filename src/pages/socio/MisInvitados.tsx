import { useState, type FormEvent } from 'react';
import { useSesion } from '../../auth/Sesion';
import { mensajeError, supabase } from '../../lib/supabase';
import { ok, temporadaActiva, useConsulta } from '../../lib/datos';
import { enlaceCarnet, euros, fecha, hoyISO } from '../../lib/formato';
import { compartirEnlace } from '../../lib/compartir';
import type { PaseDia } from '../../lib/tipos';
import { Modal } from '../../components/Modal';
import { Qr } from '../../components/Qr';

/** El socio pide los pases de invitado de su familia */
export function MisInvitados() {
  const { perfil } = useSesion();
  const socioId = perfil!.socio_id!;
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [dia, setDia] = useState(hoyISO());
  const [error, setError] = useState('');
  const [ver, setVer] = useState<PaseDia | null>(null);

  const { datos, recargar } = useConsulta(async () => {
    const t = await temporadaActiva();
    const pases = t
      ? (ok(
          await supabase.from('pases_dia').select('*').eq('temporada_id', t.id).order('fecha', { ascending: false }),
        ) as PaseDia[])
      : [];
    return { t, pases };
  });
  const t = datos?.t;
  const usados = datos?.pases.length ?? 0;
  const quedan = t ? Math.max(0, t.max_pases_por_socio - usados) : 0;

  async function pedir(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const p = ok(
        await supabase
          .from('pases_dia')
          .insert({ socio_id: socioId, nombre_invitado: nombre.trim(), dni_invitado: dni.trim().toUpperCase() || null, fecha: dia })
          .select()
          .single(),
      ) as PaseDia;
      setNombre('');
      setDni('');
      setVer(p);
      recargar();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  if (!datos) return <p className="tenue">Cargando…</p>;
  if (!t) return <p className="aviso aviso-alerta">Ahora mismo no hay temporada abierta.</p>;

  return (
    <div className="pila">
      <h2>Invitados</h2>
      <p className="tenue">
        Te quedan <strong>{quedan}</strong> de {t.max_pases_por_socio} pases esta temporada.
        {t.precio_pase > 0 && ` Cada pase cuesta ${euros(t.precio_pase)} y se paga en la taquilla.`}
      </p>
      {quedan > 0 && (
        <form className="tarjeta formulario" onSubmit={pedir}>
          <label>
            Nombre y apellidos del invitado
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="off" />
          </label>
          <div className="fila">
            <label>
              Día
              <input type="date" value={dia} min={hoyISO()} max={t.fecha_fin} onChange={(e) => setDia(e.target.value)} required />
            </label>
            <label>
              DNI (opcional)
              <input value={dni} onChange={(e) => setDni(e.target.value)} autoComplete="off" />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <button className="boton boton-grande">Pedir pase</button>
        </form>
      )}
      <ul className="lista">
        {datos.pases.map((p) => (
          <li key={p.id} className="fila-socio">
            <div className="crece">
              <strong>{p.nombre_invitado}</strong>
              <small>
                {fecha(p.fecha)}
                {p.importe > 0 && ` · ${euros(p.importe)} ${p.pagado ? 'pagado' : 'a pagar en taquilla'}`}
              </small>
            </div>
            {p.fecha >= hoyISO() && (
              <button className="boton boton-secundario" onClick={() => setVer(p)}>
                QR
              </button>
            )}
          </li>
        ))}
      </ul>
      {ver && (
        <Modal titulo={`Pase de ${ver.nombre_invitado}`} onCerrar={() => setVer(null)}>
          <div className="centrado-texto pila">
            <Qr valor={ver.codigo_qr} tamano={240} className="qr-grande" />
            <p className="tenue">
              Válido el {fecha(ver.fecha)}.{!ver.pagado && ver.importe > 0 && ` Se paga en la taquilla (${euros(ver.importe)}).`}
            </p>
            <button
              className="boton boton-grande"
              onClick={() =>
                compartirEnlace('Pase de invitado · CD Los Sauces', `Pase de invitado para ${ver.nombre_invitado} (piscina CD Los Sauces):`, enlaceCarnet(ver.codigo_qr))
              }
            >
              📲 Enviar pase al invitado
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

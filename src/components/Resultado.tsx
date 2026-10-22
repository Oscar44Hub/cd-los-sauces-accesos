import { useEffect } from 'react';
import type { ResultadoAcceso } from '../lib/tipos';
import { PARENTESCOS, etiquetas, hora, nombreCompleto } from '../lib/formato';
import { Foto } from './Foto';

/** Pantalla completa verde/roja con el resultado del escaneo. Se cierra sola. */
export function Resultado({ r, onCerrar, segundos = 4 }: { r: ResultadoAcceso; onCerrar: () => void; segundos?: number }) {
  useEffect(() => {
    const id = setTimeout(onCerrar, (r.resultado === 'autorizado' ? segundos : segundos + 2) * 1000);
    return () => clearTimeout(id);
  }, [r, onCerrar, segundos]);

  const p = r.persona;
  const ok = r.resultado === 'autorizado';
  const clase = ok ? (r.tipo === 'salida' ? 'resultado-salida' : 'resultado-ok') : 'resultado-no';

  return (
    <div className={`resultado ${clase}`} onClick={onCerrar} role="alertdialog" aria-live="assertive">
      <div className="resultado-titulo">
        {ok ? (r.tipo === 'salida' ? '👋 SALIDA' : '✅ ADELANTE') : '⛔ NO PUEDE PASAR'}
      </div>
      {p && (
        <div className="resultado-persona">
          {p.tipo === 'socio' ? (
            <Foto path={p.foto_path} nombre={nombreCompleto(p)} tamano={150} />
          ) : (
            <div className="foto foto-invitado" style={{ width: 150, height: 188 }}>
              🎟️
            </div>
          )}
          <h2>{nombreCompleto(p)}</h2>
          <p>
            {p.tipo === 'socio'
              ? `${PARENTESCOS[p.parentesco!]} · Socio nº ${p.numero_socio}`
              : `Invitado del socio nº ${p.numero_socio}`}
            {p.edad != null && ` · ${p.edad} años`}
          </p>
          <div className="etiquetas">
            {etiquetas(p).map((e) => (
              <span key={e} className="etiqueta">
                {e}
              </span>
            ))}
          </div>
          {p.observaciones && <p className="resultado-nota">📝 {p.observaciones}</p>}
        </div>
      )}
      {r.motivo && <p className="resultado-motivo">{r.motivo}</p>}
      <p className="resultado-pie">
        {r.duplicado ? 'Ya registrado' : 'Registrado'} a las {hora(r.fecha_hora)} · {r.aforo} dentro
        <br />
        Toca para continuar
      </p>
    </div>
  );
}

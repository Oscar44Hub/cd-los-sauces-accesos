import { Link } from 'react-router-dom';
import { useSesion } from '../../auth/Sesion';
import { useConsulta } from '../../lib/datos';
import { PARENTESCOS, edad, etiquetas, nombreCompleto, nombreFamilia } from '../../lib/formato';
import { Foto } from '../../components/Foto';
import { Qr } from '../../components/Qr';
import { miFamilia } from './datos';

/** Carnets de toda la familia: se enseñan en la entrada desde el móvil */
export function MiFamilia() {
  const { perfil } = useSesion();
  const { datos, error } = useConsulta(() => miFamilia(perfil!.socio_id!), [perfil?.socio_id]);
  if (error) return <p className="error">No se ha podido cargar tu familia.</p>;
  if (!datos) return <p className="tenue">Cargando…</p>;
  const { socio, t } = datos;
  const cuota = socio.cuotas.find((c) => c.temporada_id === t?.id);
  const alDia = socio.exento_cuota || cuota?.pagada;

  return (
    <div className="pila">
      <div>
        <h2>{nombreFamilia(socio)}</h2>
        <p className="tenue">Socio nº {socio.numero}</p>
      </div>
      {t && (
        <Link to="/cuota" className={`aviso ${alDia ? 'aviso-ok' : 'aviso-alerta'}`}>
          {alDia
            ? `✔ Cuota ${t.nombre} al día`
            : `Cuota ${t.nombre} pendiente: no podréis entrar hasta pagarla. Ver detalle →`}
        </Link>
      )}
      <p className="tenue">Toca un carnet para abrirlo en grande y enseñarlo en la entrada.</p>
      {socio.personas
        .filter((p) => p.activo)
        .map((p) => {
          const e = edad(p.fecha_nacimiento);
          return (
            <Link key={p.id} to={`/carnet/${p.codigo_qr}`} className="tarjeta carnet-familia">
              <Foto path={p.foto_path} nombre={nombreCompleto(p)} tamano={56} />
              <div className="crece">
                <strong>{nombreCompleto(p)}</strong>
                <span className="tenue">
                  {PARENTESCOS[p.parentesco]}
                  {e != null && ` · ${e} años`}
                </span>
                <div className="etiquetas">
                  {etiquetas({ ...p, edad: e }).map((x) => (
                    <span key={x} className="etiqueta">
                      {x}
                    </span>
                  ))}
                  {p.estado_tarjeta !== 'activa' && <span className="etiqueta etiqueta-no">Carnet {p.estado_tarjeta}</span>}
                </div>
              </div>
              <Qr valor={p.codigo_qr} tamano={72} />
            </Link>
          );
        })}
      <p className="tenue">
        El carnet impreso es obligatorio; el del móvil es un complemento. Si perdéis un carnet, avisad a la junta para
        anularlo y haceros uno nuevo.
      </p>
    </div>
  );
}

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ok, temporadaActiva, useConsulta } from '../lib/datos';
import { fecha, hoyISO } from '../lib/formato';
import { useSesion } from '../auth/Sesion';

interface Resumen {
  total_visitas: number;
  invitados: number;
  denegados: number;
}

export function Inicio() {
  const { esAdmin } = useSesion();
  const { datos, recargar } = useConsulta(async () => {
    const hoy = hoyISO();
    const [t, aforo, est] = await Promise.all([
      temporadaActiva(),
      supabase.rpc('aforo_actual').then(ok<number>),
      supabase.rpc('estadisticas', { p_desde: hoy, p_hasta: hoy }).then(ok<Resumen>),
    ]);
    return { t, aforo, est };
  });

  // Se refresca solo cada 30 segundos
  useEffect(() => {
    const id = setInterval(recargar, 30_000);
    return () => clearInterval(id);
  }, [recargar]);

  const t = datos?.t;
  const hoy = hoyISO();
  const abierta = t && hoy >= t.fecha_inicio && hoy <= t.fecha_fin;

  return (
    <div className="pila">
      {!t && datos && (
        <div className="aviso aviso-alerta">
          No hay ninguna temporada activa: nadie podrá entrar.{' '}
          {esAdmin && <Link to="/temporadas">Crear o activar temporada</Link>}
        </div>
      )}
      {t && !abierta && (
        <div className="aviso aviso-alerta">
          La temporada «{t.nombre}» va del {fecha(t.fecha_inicio)} al {fecha(t.fecha_fin)}. Hoy no se permiten
          entradas.
        </div>
      )}

      <Link to="/presentes" className="tarjeta aforo">
        <span className="tenue">Personas dentro ahora</span>
        <strong>
          {datos?.aforo ?? '–'}
          {t?.aforo_maximo ? <small> / {t.aforo_maximo}</small> : null}
        </strong>
        {t?.aforo_maximo ? (
          <div className="barra">
            <div style={{ width: `${Math.min(100, ((datos?.aforo ?? 0) / t.aforo_maximo) * 100)}%` }} />
          </div>
        ) : null}
      </Link>

      <div className="cifras">
        <div className="tarjeta">
          <strong>{datos?.est.total_visitas ?? '–'}</strong>
          <span>entradas hoy</span>
        </div>
        <div className="tarjeta">
          <strong>{datos?.est.invitados ?? '–'}</strong>
          <span>invitados</span>
        </div>
        <div className="tarjeta">
          <strong>{datos?.est.denegados ?? '–'}</strong>
          <span>rechazos</span>
        </div>
      </div>

      <Link to="/escanear" className="boton boton-enorme">
        📷 Escanear carnet
      </Link>
      <div className="fila">
        <Link to="/invitados" className="boton boton-secundario">
          🎟️ Nuevo invitado
        </Link>
        <Link to="/socios" className="boton boton-secundario">
          🔎 Buscar socio
        </Link>
      </div>
      {t && <p className="tenue centrado-texto">Temporada {t.nombre}</p>}
    </div>
  );
}

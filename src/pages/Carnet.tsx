import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PARENTESCOS, fecha } from '../lib/formato';
import type { CarnetPublico } from '../lib/tipos';
import { Qr } from '../components/Qr';
import { carnetsGuardados, guardarCarnet } from './MisCarnets';

/** Carnet digital que el socio abre en su móvil (no necesita cuenta). */
export function Carnet() {
  const { codigo = '' } = useParams();
  // key: al pasar de un carnet a otro se empieza de cero (estado de «guardado», datos…)
  return <VistaCarnet key={codigo} codigo={codigo} />;
}

function VistaCarnet({ codigo }: { codigo: string }) {
  const [c, setC] = useState<CarnetPublico | null | undefined>(undefined);
  const [guardado, setGuardado] = useState(() => carnetsGuardados().some((x) => x.codigo === codigo));

  useEffect(() => {
    const valido = /^[0-9a-f-]{36}$/i.test(codigo);
    if (!valido) {
      setC(null);
      return;
    }
    supabase.rpc('carnet_publico', { p_codigo: codigo }).then(({ data }) => setC((data as CarnetPublico) ?? null));
  }, [codigo]);

  // Mantener la pantalla encendida mientras se enseña el carnet
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<typeof lock> } };
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (c && guardado) guardarCarnet({ codigo, nombre: c.nombre });
  }, [c, guardado, codigo]);

  if (c === undefined) return <p className="centrado">Cargando carnet…</p>;
  if (c === null)
    return (
      <div className="centrado tarjeta-aviso">
        <h2>Carnet no válido</h2>
        <p>Este carnet ya no existe o se ha sustituido por uno nuevo. Pide el enlace actualizado al club.</p>
        <Link to="/mis-carnets">Mis carnets</Link>
      </div>
    );

  const invitado = c.tipo === 'invitado';
  return (
    <div className="carnet-digital">
      <div className={`carnet-movil ${c.valido ? '' : 'carnet-no-valido'}`}>
        <div className="carnet-banda">
          <img src="./icono.svg" alt="" />
          <span>CD LOS SAUCES</span>
          <small>Piscina · Papatrigo</small>
        </div>
        <div className="carnet-qr-grande">
          <Qr valor={c.codigo} tamano={250} />
        </div>
        <h1>
          {c.nombre} {c.apellidos}
        </h1>
        <p>
          {invitado
            ? `Invitado del socio nº ${c.numero_socio} · válido el ${fecha(c.fecha)}`
            : `Socio nº ${c.numero_socio} · ${PARENTESCOS[c.parentesco!]}`}
        </p>
        <div className="etiquetas centrado-flex">
          {c.es_fundador && <span className="etiqueta">Fundador</span>}
          {c.es_jubilado && <span className="etiqueta">Jubilado</span>}
          {!invitado && c.temporada && (
            <span className={`etiqueta ${c.cuota_al_dia ? '' : 'etiqueta-no'}`}>
              {c.temporada}: {c.cuota_al_dia ? 'cuota al día' : 'cuota pendiente'}
            </span>
          )}
        </div>
        {!c.valido && <p className="error">{invitado ? 'Este pase no es para hoy' : 'Carnet desactivado. Contacta con el club.'}</p>}
      </div>
      <p className="tenue centrado-texto">Sube el brillo de la pantalla y acércalo al lector de la entrada.</p>
      {!invitado && !guardado && (
        <button className="boton boton-grande" onClick={() => setGuardado(true)}>
          Guardar en este móvil
        </button>
      )}
      {guardado && (
        <p className="tenue centrado-texto">
          Guardado. Añade esta página a la pantalla de inicio (menú del navegador → «Añadir a pantalla de inicio») para
          tenerlo siempre a mano. <Link to="/mis-carnets">Ver todos mis carnets</Link>
        </p>
      )}
    </div>
  );
}

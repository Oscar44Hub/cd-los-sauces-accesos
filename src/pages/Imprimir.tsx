import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ok, useConsulta } from '../lib/datos';
import { PARENTESCOS, nombreCompleto } from '../lib/formato';
import type { Persona } from '../lib/tipos';
import { Foto } from '../components/Foto';
import { Qr } from '../components/Qr';

type PersonaSocio = Persona & { socios: { numero: number; tipo: string } };
type Formato = 'a4' | 'pvc';

/** Hoja de carnets para imprimir: 10 por A4 (para recortar y plastificar) o 1 por página (impresora de tarjetas PVC). */
export function Imprimir() {
  const [params] = useSearchParams();
  const [formato, setFormato] = useState<Formato>('a4');
  const ids = (params.get('ids') ?? '').split(',').map(Number).filter(Boolean);

  const { datos, cargando } = useConsulta(async () => {
    let q = supabase.from('personas').select('*, socios!inner(numero, tipo)').eq('activo', true);
    if (ids.length) q = q.in('id', ids);
    const r = ok(await q) as PersonaSocio[];
    return r.sort((a, b) => a.socios.numero - b.socios.numero);
  }, [params.get('ids')]);

  return (
    <div className={`hoja-impresion formato-${formato}`}>
      <style>{formato === 'a4' ? '@page { size: A4; margin: 10mm; }' : '@page { size: 85.6mm 54mm; margin: 0; }'}</style>
      <div className="no-imprimir barra-impresion">
        <button className="enlace" onClick={() => history.back()}>
          ← Volver
        </button>
        <select value={formato} onChange={(e) => setFormato(e.target.value as Formato)} aria-label="Formato">
          <option value="a4">Folio A4 (10 por hoja, recortar)</option>
          <option value="pvc">Impresora de tarjetas PVC (CR80)</option>
        </select>
        <button className="boton" onClick={() => window.print()} disabled={!datos?.length}>
          🖨️ Imprimir {datos?.length ?? ''} carnet{datos?.length === 1 ? '' : 's'}
        </button>
        <p className="tenue">
          Consejo: en el diálogo de impresión elige «Tamaño real / 100 %» y desactiva encabezados y pies de página.
        </p>
      </div>
      {cargando && <p className="no-imprimir">Cargando…</p>}
      <div className="carnets">
        {datos?.map((p) => (
          <div key={p.id} className="carnet-impreso">
            <div className="carnet-banda">
              <img src="./icono.svg" alt="" />
              <span>CLUB DEPORTIVO LOS SAUCES</span>
              <small>Papatrigo</small>
            </div>
            <div className="carnet-cuerpo">
              <Foto path={p.foto_path} nombre={nombreCompleto(p)} tamano={78} className="carnet-foto" />
              <div className="carnet-datos">
                <strong className="carnet-nombre">{p.nombre}</strong>
                <span className="carnet-apellidos">{p.apellidos}</span>
                <span className="carnet-numero">Socio nº {p.socios.numero}</span>
                <span className="carnet-tipo">
                  {PARENTESCOS[p.parentesco]}
                  {p.socios.tipo === 'individual' ? ' · Individual' : ''}
                </span>
                <span className="carnet-etiquetas">
                  {p.es_fundador && <b>FUNDADOR</b>}
                  {p.es_jubilado && <b>JUBILADO</b>}
                </span>
              </div>
              <Qr valor={p.codigo_qr} tamano={92} className="carnet-qr" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

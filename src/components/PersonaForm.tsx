import { useState, type FormEvent } from 'react';
import { mensajeError, supabase } from '../lib/supabase';
import { ok } from '../lib/datos';
import { olvidarFoto } from '../lib/fotos';
import { prepararFoto } from '../lib/imagen';
import { PARENTESCOS } from '../lib/formato';
import type { Parentesco, Persona } from '../lib/tipos';
import { Foto } from './Foto';

type Campos = Pick<
  Persona,
  'nombre' | 'apellidos' | 'parentesco' | 'fecha_nacimiento' | 'dni' | 'telefono' | 'email' | 'es_jubilado' | 'es_fundador' | 'observaciones'
>;

export function PersonaForm({ socioId, persona, parentescoInicial, onGuardado }: {
  socioId: number;
  persona: Persona | null;
  parentescoInicial: Parentesco;
  onGuardado: () => void;
}) {
  const [c, setC] = useState<Campos>({
    nombre: persona?.nombre ?? '',
    apellidos: persona?.apellidos ?? '',
    parentesco: persona?.parentesco ?? parentescoInicial,
    fecha_nacimiento: persona?.fecha_nacimiento ?? null,
    dni: persona?.dni ?? null,
    telefono: persona?.telefono ?? null,
    email: persona?.email ?? null,
    es_jubilado: persona?.es_jubilado ?? false,
    es_fundador: persona?.es_fundador ?? false,
    observaciones: persona?.observaciones ?? null,
  });
  const [foto, setFoto] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const campo = <K extends keyof Campos>(k: K, v: Campos[K]) => setC((x) => ({ ...x, [k]: v }));
  const texto = (k: 'nombre' | 'apellidos' | 'dni' | 'telefono' | 'email' | 'observaciones') => ({
    value: c[k] ?? '',
    onChange: (e: { target: { value: string } }) => campo(k, e.target.value || (k === 'nombre' || k === 'apellidos' ? '' : null)),
  });

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const datos = { ...c, nombre: c.nombre.trim(), apellidos: c.apellidos.trim(), dni: c.dni?.trim().toUpperCase() || null };
      const p = (persona
        ? ok(await supabase.from('personas').update(datos).eq('id', persona.id).select().single())
        : ok(await supabase.from('personas').insert({ ...datos, socio_id: socioId }).select().single())) as Persona;

      if (foto) {
        const blob = await prepararFoto(foto);
        const path = `${p.id}/${Date.now()}.jpg`;
        const { error: e1 } = await supabase.storage.from('fotos').upload(path, blob, { contentType: 'image/jpeg' });
        if (e1) throw e1;
        ok(await supabase.from('personas').update({ foto_path: path }).eq('id', p.id).select());
        if (p.foto_path) {
          olvidarFoto(p.foto_path);
          await supabase.storage.from('fotos').remove([p.foto_path]);
        }
      }
      onGuardado();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="formulario" onSubmit={guardar}>
      <div className="foto-editor">
        {vistaPrevia ? (
          <div className="foto" style={{ width: 96, height: 120 }}>
            <img src={vistaPrevia} alt="Vista previa" />
          </div>
        ) : (
          <Foto path={persona?.foto_path} nombre={`${c.nombre} ${c.apellidos}`} tamano={96} />
        )}
        <label className="boton boton-secundario">
          📸 {persona?.foto_path || vistaPrevia ? 'Cambiar foto' : 'Hacer o subir foto'}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFoto(f);
              setVistaPrevia(f ? URL.createObjectURL(f) : null);
            }}
          />
        </label>
      </div>
      <div className="fila">
        <label>
          Nombre
          <input {...texto('nombre')} required autoComplete="off" />
        </label>
        <label>
          Apellidos
          <input {...texto('apellidos')} required autoComplete="off" />
        </label>
      </div>
      <div className="fila">
        <label>
          Parentesco
          <select value={c.parentesco} onChange={(e) => campo('parentesco', e.target.value as Parentesco)}>
            {Object.entries(PARENTESCOS).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fecha de nacimiento
          <input
            type="date"
            value={c.fecha_nacimiento ?? ''}
            onChange={(e) => campo('fecha_nacimiento', e.target.value || null)}
          />
        </label>
      </div>
      <div className="fila">
        <label className="casilla">
          <input type="checkbox" checked={c.es_fundador} onChange={(e) => campo('es_fundador', e.target.checked)} />
          Socio fundador
        </label>
        <label className="casilla">
          <input type="checkbox" checked={c.es_jubilado} onChange={(e) => campo('es_jubilado', e.target.checked)} />
          Jubilado
        </label>
      </div>
      <details>
        <summary>Más datos (opcionales)</summary>
        <div className="fila">
          <label>
            DNI
            <input {...texto('dni')} autoComplete="off" />
          </label>
          <label>
            Teléfono
            <input {...texto('telefono')} type="tel" />
          </label>
        </div>
        <label>
          Email
          <input {...texto('email')} type="email" />
        </label>
        <label>
          Nota para la taquilla
          <input {...texto('observaciones')} placeholder="Ej.: debe entrar acompañado de un adulto" />
        </label>
      </details>
      {error && <p className="error">{error}</p>}
      <button className="boton boton-grande" disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}

import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mensajeError, supabase } from '../lib/supabase';
import { ok, temporadaActiva, useConsulta } from '../lib/datos';
import { TIPOS_SOCIO, nombreCompleto, normalizar } from '../lib/formato';
import type { SocioCompleto, TipoSocio } from '../lib/tipos';
import { useSesion } from '../auth/Sesion';
import { Foto } from '../components/Foto';

type Filtro = 'todos' | 'pendientes' | 'bajas';

export function Socios() {
  const { esAdmin } = useSesion();
  const navegar = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [creando, setCreando] = useState(false);

  const { datos, cargando, error } = useConsulta(async () => {
    const [t, socios] = await Promise.all([
      temporadaActiva(),
      supabase.from('socios').select('*, personas(*), cuotas(*)').order('numero').then(ok<SocioCompleto[]>),
    ]);
    return { t, socios };
  });

  const lista = useMemo(() => {
    if (!datos) return [];
    const q = normalizar(busqueda);
    const pagado = (s: SocioCompleto) =>
      s.exento_cuota || s.cuotas.some((c) => c.temporada_id === datos.t?.id && c.pagada);
    return datos.socios.filter((s) => {
      if (filtro === 'bajas' ? s.activo : !s.activo) return false;
      if (filtro === 'pendientes' && pagado(s)) return false;
      if (!q) return true;
      if (String(s.numero) === q) return true;
      return s.personas.some((p) => normalizar(nombreCompleto(p)).includes(q) || normalizar(p.dni ?? '') === q);
    }).map((s) => ({ ...s, pagado: pagado(s) }));
  }, [datos, busqueda, filtro]);

  const siguienteNumero = Math.max(0, ...(datos?.socios.map((s) => s.numero) ?? [])) + 1;

  return (
    <div className="pila">
      <div className="fila">
        <input
          type="search"
          placeholder="Nombre, apellido, DNI o nº de socio"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar socio"
        />
        {esAdmin && (
          <button className="boton" onClick={() => setCreando(true)}>
            + Socio
          </button>
        )}
        <Link to="/imprimir" className="boton boton-secundario" title="Imprimir todos los carnets">
          🖨️
        </Link>
      </div>
      <div className="segmentado pequeno">
        {(['todos', 'pendientes', 'bajas'] as Filtro[]).map((f) => (
          <button key={f} className={filtro === f ? 'activo' : ''} onClick={() => setFiltro(f)}>
            {f === 'todos' ? 'Activos' : f === 'pendientes' ? 'Cuota pendiente' : 'Bajas'}
          </button>
        ))}
      </div>

      {creando && (
        <NuevoSocio
          numero={siguienteNumero}
          onCancelar={() => setCreando(false)}
          onCreado={(id) => navegar(`/socios/${id}`)}
        />
      )}

      {error ? <p className="error">{mensajeError(error)}</p> : null}
      {cargando && !datos && <p className="tenue">Cargando socios…</p>}
      <p className="tenue">
        {lista.length} socio{lista.length === 1 ? '' : 's'} · {lista.reduce((n, s) => n + s.personas.length, 0)} personas
      </p>

      <ul className="lista">
        {lista.map((s) => {
          const titular = s.personas.find((p) => p.parentesco === 'titular') ?? s.personas[0];
          return (
            <li key={s.id}>
              <Link to={`/socios/${s.id}`} className="fila-socio">
                <Foto path={titular?.foto_path} nombre={titular ? nombreCompleto(titular) : '?'} tamano={44} />
                <div>
                  <strong>
                    Nº {s.numero} · {titular ? nombreCompleto(titular) : 'Sin personas'}
                  </strong>
                  <small>
                    {TIPOS_SOCIO[s.tipo]} · {s.personas.length} persona{s.personas.length === 1 ? '' : 's'}
                    {s.personas.some((p) => p.es_fundador) && ' · Fundador'}
                    {s.personas.some((p) => p.es_jubilado) && ' · Jubilado'}
                  </small>
                </div>
                <span className={`estado ${s.pagado ? 'estado-ok' : 'estado-no'}`}>
                  {s.exento_cuota ? 'Exento' : s.pagado ? 'Pagado' : 'Pendiente'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NuevoSocio({ numero, onCancelar, onCreado }: {
  numero: number;
  onCancelar: () => void;
  onCreado: (id: number) => void;
}) {
  const [num, setNum] = useState(String(numero));
  const [tipo, setTipo] = useState<TipoSocio>('familiar');
  const [error, setError] = useState('');

  async function crear(e: FormEvent) {
    e.preventDefault();
    try {
      const s = ok(await supabase.from('socios').insert({ numero: Number(num), tipo }).select('id').single());
      onCreado((s as unknown as { id: number }).id);
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <form className="tarjeta formulario" onSubmit={crear}>
      <h3>Nuevo socio</h3>
      <div className="fila">
        <label>
          Nº de socio
          <input type="number" min={1} value={num} onChange={(e) => setNum(e.target.value)} required />
        </label>
        <label>
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoSocio)}>
            <option value="familiar">Familiar</option>
            <option value="individual">Individual</option>
          </select>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="fila">
        <button type="button" className="boton boton-secundario" onClick={onCancelar}>
          Cancelar
        </button>
        <button className="boton">Crear y añadir personas</button>
      </div>
    </form>
  );
}

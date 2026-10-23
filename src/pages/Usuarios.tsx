import { useState } from 'react';
import { mensajeError, supabase } from '../lib/supabase';
import { ok, useConsulta } from '../lib/datos';
import { nombreFamilia, normalizar } from '../lib/formato';
import type { Perfil, Rol, SocioCompleto } from '../lib/tipos';
import { useSesion } from '../auth/Sesion';

const ROLES: Record<Rol, string> = {
  pendiente: 'Sin acceso',
  socio: 'Socio (ve su familia)',
  admin: 'Admin (control de acceso)',
  superadmin: 'Superadmin (todo)',
};

export function Usuarios() {
  const { perfil } = useSesion();
  const [error, setError] = useState('');
  const { datos, recargar } = useConsulta(async () => {
    const [usuarios, socios] = await Promise.all([
      supabase.from('perfiles').select('*').order('creado_en').then(ok<Perfil[]>),
      supabase.from('socios').select('*, personas(*)').order('numero').then(ok<SocioCompleto[]>),
    ]);
    return { usuarios, socios };
  });

  async function guardar(u: Perfil, cambios: Partial<Perfil>) {
    setError('');
    try {
      ok(await supabase.from('perfiles').update(cambios).eq('id', u.id).select());
      recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  /** Familia cuyo email (o el de alguno de sus miembros) coincide con el de la cuenta */
  function sugerencia(u: Perfil): SocioCompleto | undefined {
    const email = normalizar(u.email ?? '');
    if (!email) return undefined;
    return datos?.socios.find(
      (s) => normalizar(s.email ?? '') === email || s.personas.some((p) => normalizar(p.email ?? '') === email),
    );
  }

  const pendientes = datos?.usuarios.filter((u) => u.rol === 'pendiente') ?? [];
  const resto = datos?.usuarios.filter((u) => u.rol !== 'pendiente') ?? [];

  function fila(u: Perfil) {
    const sug = sugerencia(u);
    return (
      <li key={u.id} className="tarjeta usuario">
        <div className="fila espaciada">
          <div className="crece">
            <strong>{u.nombre ?? u.email}</strong>
            <br />
            <small className="tenue">{u.email}</small>
          </div>
          <select
            value={u.rol}
            disabled={u.id === perfil?.id}
            onChange={(e) => {
              const rol = e.target.value as Rol;
              guardar(u, { rol, socio_id: rol === 'socio' ? (u.socio_id ?? sug?.id ?? null) : null });
            }}
            aria-label={`Perfil de ${u.email}`}
          >
            {Object.entries(ROLES).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </div>
        {u.rol === 'socio' && (
          <label>
            Familia vinculada
            <select
              value={u.socio_id ?? ''}
              onChange={(e) => guardar(u, { socio_id: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">— Elige la familia —</option>
              {datos?.socios.map((s) => (
                <option key={s.id} value={s.id}>
                  Nº {s.numero} · {nombreFamilia(s)}
                </option>
              ))}
            </select>
            {!u.socio_id && <span className="error">Sin familia vinculada: no podrá ver nada.</span>}
          </label>
        )}
        {u.rol === 'pendiente' && sug && (
          <button className="boton boton-secundario" onClick={() => guardar(u, { rol: 'socio', socio_id: sug.id })}>
            Es socio: vincular a {nombreFamilia(sug)} (nº {sug.numero})
          </button>
        )}
      </li>
    );
  }

  return (
    <div className="pila">
      <h2>Usuarios y socios con cuenta</h2>
      <p className="tenue">
        Cualquiera puede crear su cuenta desde la pantalla de entrada. Aquí decides qué es cada uno: un{' '}
        <strong>socio</strong> (vinculado a su familia), personal de taquilla (<strong>admin</strong>) o de la junta (
        <strong>superadmin</strong>).
      </p>
      {error && <p className="error">{error}</p>}
      {pendientes.length > 0 && (
        <>
          <h3>Pendientes de activar ({pendientes.length})</h3>
          <ul className="lista">{pendientes.map(fila)}</ul>
        </>
      )}
      <h3>Cuentas activas ({resto.length})</h3>
      <ul className="lista">{resto.map(fila)}</ul>
    </div>
  );
}

import { supabase } from '../lib/supabase';
import { ok, useConsulta } from '../lib/datos';
import type { Perfil, Rol } from '../lib/tipos';
import { useSesion } from '../auth/Sesion';

const ROLES: Record<Rol, string> = {
  pendiente: 'Sin acceso',
  taquilla: 'Taquilla (escanear, invitados)',
  admin: 'Administrador (junta)',
};

export function Usuarios() {
  const { perfil } = useSesion();
  const { datos, recargar } = useConsulta(
    async () => ok(await supabase.from('perfiles').select('*').order('creado_en')) as Perfil[],
  );

  async function cambiar(u: Perfil, rol: Rol) {
    await supabase.from('perfiles').update({ rol }).eq('id', u.id);
    recargar();
  }

  return (
    <div className="pila">
      <h2>Usuarios de la app</h2>
      <p className="tenue">
        Quien vaya a llevar la taquilla crea su cuenta desde la pantalla de entrada; después le das permiso aquí.
      </p>
      <ul className="lista">
        {datos?.map((u) => (
          <li key={u.id} className="fila-socio">
            <div className="crece">
              <strong>{u.nombre ?? u.email}</strong>
              <small>{u.email}</small>
            </div>
            <select
              value={u.rol}
              disabled={u.id === perfil?.id}
              onChange={(e) => cambiar(u, e.target.value as Rol)}
              aria-label={`Permiso de ${u.email}`}
            >
              {Object.entries(ROLES).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}

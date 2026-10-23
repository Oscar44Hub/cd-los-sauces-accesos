import { NavLink, Outlet } from 'react-router-dom';
import { useSesion } from '../auth/Sesion';
import { supabase } from '../lib/supabase';

/** Estructura de la app para los socios: su familia, su cuota, sus entradas y sus invitados */
export function LayoutSocio() {
  const { perfil } = useSesion();
  return (
    <div className="app">
      <header className="cabecera">
        <NavLink to="/" className="marca">
          <img src="./icono.svg" alt="" width={32} height={32} />
          <span>
            <strong>CD Los Sauces</strong>
            <small>Área del socio</small>
          </span>
        </NavLink>
        <details className="menu-usuario">
          <summary aria-label="Menú">☰</summary>
          <div onClick={(e) => ((e.currentTarget.parentElement as HTMLDetailsElement).open = false)}>
            <p className="tenue">{perfil?.nombre ?? perfil?.email}</p>
            <button className="enlace" onClick={() => supabase.auth.signOut()}>
              Cerrar sesión
            </button>
          </div>
        </details>
      </header>
      <main className="contenido">
        <Outlet />
      </main>
      <nav className="pestanas">
        <NavLink to="/" end>
          <span>🪪</span>Carnets
        </NavLink>
        <NavLink to="/cuota">
          <span>💶</span>Mi cuota
        </NavLink>
        <NavLink to="/entradas">
          <span>🏊</span>Entradas
        </NavLink>
        <NavLink to="/invitados">
          <span>🎟️</span>Invitados
        </NavLink>
      </nav>
    </div>
  );
}

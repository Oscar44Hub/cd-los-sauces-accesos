import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useSesion } from '../auth/Sesion';
import { supabase } from '../lib/supabase';

export function Layout() {
  const { perfil, esSuper } = useSesion();
  const navegar = useNavigate();
  return (
    <div className="app">
      <header className="cabecera">
        <NavLink to="/" className="marca">
          <img src="./icono.svg" alt="" width={32} height={32} />
          <span>
            <strong>CD Los Sauces</strong>
            <small>Piscina · Papatrigo</small>
          </span>
        </NavLink>
        <details className="menu-usuario">
          <summary aria-label="Menú">☰</summary>
          <div onClick={(e) => ((e.currentTarget.parentElement as HTMLDetailsElement).open = false)}>
            <p className="tenue">
              {perfil?.nombre ?? perfil?.email}
              <br />
              <small>{esSuper ? 'Superadmin' : 'Admin (control de acceso)'}</small>
            </p>
            <NavLink to="/presentes">Personas dentro</NavLink>
            <NavLink to="/estadisticas">Estadísticas</NavLink>
            {esSuper && <NavLink to="/pagos">Pagos y cuotas</NavLink>}
            {esSuper && <NavLink to="/temporadas">Temporadas</NavLink>}
            {esSuper && <NavLink to="/usuarios">Usuarios y socios con cuenta</NavLink>}
            <button
              className="enlace"
              onClick={async () => {
                await supabase.auth.signOut();
                navegar('/');
              }}
            >
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
          <span>🏠</span>Inicio
        </NavLink>
        <NavLink to="/escanear" className="pestana-principal">
          <span>📷</span>Escanear
        </NavLink>
        <NavLink to="/socios">
          <span>👨‍👩‍👧</span>Familias
        </NavLink>
        <NavLink to="/invitados">
          <span>🎟️</span>Invitados
        </NavLink>
      </nav>
    </div>
  );
}

import { lazy, Suspense, type ReactElement } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SesionProvider, useSesion } from './auth/Sesion';
import { Layout } from './components/Layout';
import { LayoutSocio } from './components/LayoutSocio';
import { configurado, supabase } from './lib/supabase';
import { Acceso } from './pages/Acceso';

const Carnet = lazy(() => import('./pages/Carnet').then((m) => ({ default: m.Carnet })));
const MisCarnets = lazy(() => import('./pages/MisCarnets').then((m) => ({ default: m.MisCarnets })));
const Inicio = lazy(() => import('./pages/Inicio').then((m) => ({ default: m.Inicio })));
const Escanear = lazy(() => import('./pages/Escanear').then((m) => ({ default: m.Escanear })));
const Socios = lazy(() => import('./pages/Socios').then((m) => ({ default: m.Socios })));
const SocioDetalle = lazy(() => import('./pages/SocioDetalle').then((m) => ({ default: m.SocioDetalle })));
const Invitados = lazy(() => import('./pages/Invitados').then((m) => ({ default: m.Invitados })));
const Presentes = lazy(() => import('./pages/Presentes').then((m) => ({ default: m.Presentes })));
const Estadisticas = lazy(() => import('./pages/Estadisticas').then((m) => ({ default: m.Estadisticas })));
const Temporadas = lazy(() => import('./pages/Temporadas').then((m) => ({ default: m.Temporadas })));
const Usuarios = lazy(() => import('./pages/Usuarios').then((m) => ({ default: m.Usuarios })));
const Imprimir = lazy(() => import('./pages/Imprimir').then((m) => ({ default: m.Imprimir })));
const Pagos = lazy(() => import('./pages/Pagos').then((m) => ({ default: m.Pagos })));
const Recibo = lazy(() => import('./pages/Recibo').then((m) => ({ default: m.Recibo })));
const MiFamilia = lazy(() => import('./pages/socio/MiFamilia').then((m) => ({ default: m.MiFamilia })));
const MiCuota = lazy(() => import('./pages/socio/MiCuota').then((m) => ({ default: m.MiCuota })));
const MisEntradas = lazy(() => import('./pages/socio/MisEntradas').then((m) => ({ default: m.MisEntradas })));
const MisInvitados = lazy(() => import('./pages/socio/MisInvitados').then((m) => ({ default: m.MisInvitados })));

function SoloSuper({ children }: { children: ReactElement }) {
  const { esSuper } = useSesion();
  return esSuper ? children : <Navigate to="/" replace />;
}

/** Cada perfil ve su propia app: personal del club (superadmin y admin) o socio */
function Principal() {
  const { cargando, sesion, perfil, esStaff, esSocio } = useSesion();
  if (cargando) return <p className="centrado">Cargando…</p>;
  if (!sesion) return <Acceso />;

  if (esSocio) {
    return (
      <Routes>
        <Route path="recibo/:id" element={<Recibo />} />
        <Route element={<LayoutSocio />}>
          <Route index element={<MiFamilia />} />
          <Route path="cuota" element={<MiCuota />} />
          <Route path="entradas" element={<MisEntradas />} />
          <Route path="invitados" element={<MisInvitados />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  if (!esStaff) {
    return (
      <div className="centrado tarjeta-aviso">
        <h2>Cuenta pendiente de aprobación</h2>
        <p>
          Has entrado como <strong>{perfil?.email ?? sesion.user.email}</strong>. La junta del club tiene que activar tu
          cuenta: si eres socio, la vinculará a tu familia; si vas a llevar la taquilla, te dará permiso de acceso.
        </p>
        <button className="boton boton-secundario" onClick={() => window.location.reload()}>
          Volver a comprobar
        </button>
        <button className="enlace" onClick={() => supabase.auth.signOut()}>
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="imprimir" element={<SoloSuper><Imprimir /></SoloSuper>} />
      <Route path="recibo/:id" element={<SoloSuper><Recibo /></SoloSuper>} />
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="escanear" element={<Escanear />} />
        <Route path="socios" element={<Socios />} />
        <Route path="socios/:id" element={<SocioDetalle />} />
        <Route path="invitados" element={<Invitados />} />
        <Route path="presentes" element={<Presentes />} />
        <Route path="estadisticas" element={<Estadisticas />} />
        <Route path="pagos" element={<SoloSuper><Pagos /></SoloSuper>} />
        <Route path="temporadas" element={<SoloSuper><Temporadas /></SoloSuper>} />
        <Route path="usuarios" element={<SoloSuper><Usuarios /></SoloSuper>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  if (!configurado) {
    return (
      <div className="centrado tarjeta-aviso">
        <h2>Falta configurar Supabase</h2>
        <p>
          Crea el archivo <code>.env.local</code> a partir de <code>.env.example</code> (o las variables del despliegue)
          con la URL y la clave pública de tu proyecto de Supabase. Los pasos están en el README.
        </p>
      </div>
    );
  }
  return (
    <SesionProvider>
      <HashRouter>
        <Suspense fallback={<p className="centrado">Cargando…</p>}>
          <Routes>
            {/* Públicas: carnet digital del socio y pase del invitado */}
            <Route path="/carnet/:codigo" element={<Carnet />} />
            <Route path="/mis-carnets" element={<MisCarnets />} />
            <Route path="/*" element={<Principal />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </SesionProvider>
  );
}

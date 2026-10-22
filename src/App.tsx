import { lazy, Suspense, type ReactElement } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SesionProvider, useSesion } from './auth/Sesion';
import { Layout } from './components/Layout';
import { configurado } from './lib/supabase';
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

function SoloStaff({ children }: { children: ReactElement }) {
  const { cargando, sesion, perfil, esStaff } = useSesion();
  if (cargando) return <p className="centrado">Cargando…</p>;
  if (!sesion) return <Acceso />;
  if (!esStaff) {
    return (
      <div className="centrado tarjeta-aviso">
        <h2>Cuenta pendiente de aprobación</h2>
        <p>
          Has entrado como <strong>{perfil?.email ?? sesion.user.email}</strong>. Un administrador del club tiene que
          darte permiso antes de que puedas usar la app.
        </p>
      </div>
    );
  }
  return children;
}

function SoloAdmin({ children }: { children: ReactElement }) {
  const { esAdmin } = useSesion();
  return esAdmin ? children : <Navigate to="/" replace />;
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
          <Route
            path="/imprimir"
            element={
              <SoloStaff>
                <Imprimir />
              </SoloStaff>
            }
          />
          <Route
            element={
              <SoloStaff>
                <Layout />
              </SoloStaff>
            }
          >
            <Route index element={<Inicio />} />
            <Route path="escanear" element={<Escanear />} />
            <Route path="socios" element={<Socios />} />
            <Route path="socios/:id" element={<SocioDetalle />} />
            <Route path="invitados" element={<Invitados />} />
            <Route path="presentes" element={<Presentes />} />
            <Route path="estadisticas" element={<Estadisticas />} />
            <Route path="temporadas" element={<SoloAdmin><Temporadas /></SoloAdmin>} />
            <Route path="usuarios" element={<SoloAdmin><Usuarios /></SoloAdmin>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </Suspense>
      </HashRouter>
    </SesionProvider>
  );
}

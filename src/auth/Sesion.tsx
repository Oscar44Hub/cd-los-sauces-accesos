import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Perfil } from '../lib/tipos';

interface EstadoSesion {
  cargando: boolean;
  sesion: Session | null;
  perfil: Perfil | null;
  esAdmin: boolean;
  esStaff: boolean;
  recargarPerfil: () => Promise<void>;
}

const Ctx = createContext<EstadoSesion | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);

  async function cargarPerfil(s: Session | null) {
    if (!s) {
      setPerfil(null);
      return;
    }
    const { data } = await supabase.from('perfiles').select('*').eq('id', s.user.id).maybeSingle();
    setPerfil((data as Perfil) ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSesion(data.session);
      await cargarPerfil(data.session);
      setCargando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSesion(s);
      // Fuera del callback para no bloquear el cliente de Supabase
      setTimeout(() => cargarPerfil(s), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const rol = perfil?.rol;
  return (
    <Ctx.Provider
      value={{
        cargando,
        sesion,
        perfil,
        esAdmin: rol === 'admin',
        esStaff: rol === 'admin' || rol === 'taquilla',
        recargarPerfil: () => cargarPerfil(sesion),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSesion() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSesion fuera de SesionProvider');
  return c;
}

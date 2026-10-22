import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { mensajeError, supabase } from '../lib/supabase';
import { carnetsGuardados } from './MisCarnets';

export function Acceso() {
  const [modo, setModo] = useState<'entrar' | 'registro'>('entrar');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const tieneCarnets = carnetsGuardados().length > 0;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setAviso('');
    setEnviando(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: clave });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: clave,
          options: { data: { nombre }, emailRedirectTo: window.location.href.split('#')[0] },
        });
        if (error) throw error;
        setAviso(
          data.session
            ? 'Cuenta creada. Un administrador tiene que aprobarla.'
            : 'Te hemos enviado un email para confirmar la cuenta. Después, un administrador tendrá que aprobarla.',
        );
      }
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pantalla-acceso">
      <img src="./icono.svg" alt="" width={88} height={88} />
      <h1>CD Los Sauces</h1>
      <p className="tenue">Control de accesos · Piscina de Papatrigo</p>

      {tieneCarnets && (
        <Link to="/mis-carnets" className="boton boton-grande boton-secundario">
          🪪 Ver mis carnets
        </Link>
      )}

      <form onSubmit={enviar} className="formulario tarjeta">
        <h2>{modo === 'entrar' ? 'Entrar (junta y taquilla)' : 'Crear cuenta de taquilla'}</h2>
        {modo === 'registro' && (
          <label>
            Nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            required
            minLength={8}
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
          />
        </label>
        {error && <p className="error">{error}</p>}
        {aviso && <p className="exito">{aviso}</p>}
        <button className="boton boton-grande" disabled={enviando}>
          {enviando ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
        </button>
        <button type="button" className="enlace" onClick={() => setModo(modo === 'entrar' ? 'registro' : 'entrar')}>
          {modo === 'entrar' ? '¿Vas a llevar la taquilla? Crea tu cuenta' : 'Ya tengo cuenta'}
        </button>
      </form>
    </div>
  );
}

import { useCallback, useRef, useState, type FormEvent } from 'react';
import { Escaner } from '../components/Escaner';
import { Resultado } from '../components/Resultado';
import { avisar } from '../lib/avisos';
import { mensajeError, supabase } from '../lib/supabase';
import type { ResultadoAcceso, TipoMovimiento } from '../lib/tipos';

export async function registrarAcceso(codigo: string, tipo: TipoMovimiento): Promise<ResultadoAcceso> {
  const { data, error } = await supabase.rpc('registrar_acceso', { p_codigo: codigo, p_tipo: tipo });
  if (error) throw error;
  return data as ResultadoAcceso;
}

// En ordenador (lector USB) el cursor se queda en la caja de texto; en el móvil no, para no sacar el teclado
const conLectorUsb = window.matchMedia('(pointer: fine)').matches;

export function Escanear() {
  const [tipo, setTipo] = useState<TipoMovimiento>('entrada');
  const [resultado, setResultado] = useState<ResultadoAcceso | null>(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [usarCamara, setUsarCamara] = useState(!conLectorUsb);
  const ocupado = useRef(false);
  const ultimo = useRef({ codigo: '', cuando: 0 });
  const caja = useRef<HTMLInputElement>(null);

  const procesar = useCallback(
    async (codigo: string) => {
      codigo = codigo.trim();
      if (!codigo || ocupado.current) return;
      // La cámara lee el mismo QR muchas veces por segundo
      if (codigo === ultimo.current.codigo && Date.now() - ultimo.current.cuando < 5000) return;
      ocupado.current = true;
      ultimo.current = { codigo, cuando: Date.now() };
      setError('');
      try {
        const r = await registrarAcceso(codigo, tipo);
        avisar(r.resultado === 'autorizado');
        setResultado(r);
      } catch (e) {
        avisar(false);
        setError(mensajeError(e));
        ocupado.current = false;
      }
    },
    [tipo],
  );

  const cerrar = useCallback(() => {
    setResultado(null);
    ocupado.current = false;
    caja.current?.focus();
  }, []);

  function enviarManual(e: FormEvent) {
    e.preventDefault();
    const c = manual;
    setManual('');
    ultimo.current.codigo = '';
    procesar(c);
  }

  return (
    <div className="pila">
      <div className="segmentado" role="radiogroup" aria-label="Tipo de movimiento">
        <button className={tipo === 'entrada' ? 'activo' : ''} onClick={() => setTipo('entrada')}>
          ➡️ Entrada
        </button>
        <button className={tipo === 'salida' ? 'activo salida' : ''} onClick={() => setTipo('salida')}>
          ⬅️ Salida
        </button>
      </div>

      {usarCamara ? (
        <Escaner onLectura={procesar} pausado={!!resultado} />
      ) : (
        <div className="tarjeta centrado-texto">
          <p>Lector USB preparado: pasa la tarjeta por el lector.</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      <form onSubmit={enviarManual} className="fila">
        <input
          ref={caja}
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Código del carnet (o lector USB)"
          autoFocus={conLectorUsb}
          aria-label="Código del carnet"
        />
        <button className="boton">OK</button>
      </form>
      <button className="enlace" onClick={() => setUsarCamara(!usarCamara)}>
        {usarCamara ? 'Usar lector USB en lugar de la cámara' : 'Usar la cámara'}
      </button>
      <p className="tenue">
        ¿El socio no trae el carnet? Búscalo en <strong>Socios</strong> y pulsa «Registrar entrada».
      </p>

      {resultado && <Resultado r={resultado} onCerrar={cerrar} />}
    </div>
  );
}

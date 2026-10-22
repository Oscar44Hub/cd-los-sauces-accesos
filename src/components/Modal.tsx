import { useEffect, type ReactNode } from 'react';

export function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal" role="dialog" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="modal-cabecera">
          <h3>{titulo}</h3>
          <button className="enlace" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

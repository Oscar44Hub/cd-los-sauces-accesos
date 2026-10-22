import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';

/**
 * Cámara que lee códigos QR. Mientras `pausado` es true no se envían lecturas
 * (por ejemplo mientras se muestra el resultado del anterior).
 */
export function Escaner({ onLectura, pausado }: { onLectura: (texto: string) => void; pausado: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const escaner = useRef<QrScanner | null>(null);
  const callback = useRef(onLectura);
  const pausa = useRef(pausado);
  const [error, setError] = useState('');
  const [camaras, setCamaras] = useState<QrScanner.Camera[]>([]);

  callback.current = onLectura;
  pausa.current = pausado;

  useEffect(() => {
    if (!video.current) return;
    const s = new QrScanner(
      video.current,
      (r) => {
        if (!pausa.current) callback.current(r.data);
      },
      { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 6 },
    );
    escaner.current = s;
    s.start()
      .then(() => QrScanner.listCameras(true).then(setCamaras))
      .catch(() =>
        setError(
          window.isSecureContext
            ? 'No se puede usar la cámara. Revisa que la app tenga permiso de cámara en el navegador.'
            : 'La cámara solo funciona con https://',
        ),
      );
    return () => {
      s.destroy();
      escaner.current = null;
    };
  }, []);

  return (
    <div className="escaner">
      <video ref={video} muted playsInline />
      {error && <p className="escaner-error">{error}</p>}
      {camaras.length > 1 && (
        <select
          className="escaner-camara"
          aria-label="Cámara"
          onChange={(e) => escaner.current?.setCamera(e.target.value)}
        >
          {camaras.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label || 'Cámara'}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

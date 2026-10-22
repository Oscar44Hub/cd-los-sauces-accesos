import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function Qr({ valor, tamano = 220, className }: { valor: string; tamano?: number; className?: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toString(valor, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then((svg) =>
      setSrc('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)),
    );
  }, [valor]);
  if (!src) return <div style={{ width: tamano, height: tamano }} className={className} />;
  return <img src={src} width={tamano} height={tamano} alt="Código QR" className={className} />;
}

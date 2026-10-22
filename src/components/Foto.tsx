import { useFoto } from '../lib/fotos';

export function Foto({ path, nombre, tamano = 56, className = '' }: {
  path: string | null | undefined;
  nombre: string;
  tamano?: number;
  className?: string;
}) {
  const url = useFoto(path);
  const iniciales = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  return (
    <div className={`foto ${className}`} style={{ width: tamano, height: tamano * 1.25, fontSize: tamano / 2.6 }}>
      {url ? <img src={url} alt={nombre} /> : <span>{iniciales}</span>}
    </div>
  );
}

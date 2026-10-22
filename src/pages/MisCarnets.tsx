import { useState } from 'react';
import { Link } from 'react-router-dom';

interface Guardado {
  codigo: string;
  nombre: string;
}

const CLAVE = 'los-sauces-carnets';

export function carnetsGuardados(): Guardado[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? '[]') as Guardado[];
  } catch {
    return [];
  }
}

export function guardarCarnet(g: Guardado) {
  try {
    const lista = carnetsGuardados().filter((x) => x.codigo !== g.codigo);
    localStorage.setItem(CLAVE, JSON.stringify([...lista, g]));
  } catch {
    /* modo privado: no se puede guardar */
  }
}

/** Los carnets de la familia guardados en este móvil (los padres suelen llevar los de los hijos). */
export function MisCarnets() {
  const [lista, setLista] = useState(carnetsGuardados);

  function quitar(codigo: string) {
    const nueva = lista.filter((x) => x.codigo !== codigo);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(nueva));
    } catch {
      /* nada */
    }
    setLista(nueva);
  }

  return (
    <div className="pantalla-acceso">
      <img src="./icono.svg" alt="" width={64} height={64} />
      <h1>Mis carnets</h1>
      {lista.length === 0 && <p className="tenue">Abre el enlace del carnet que te ha enviado el club y pulsa «Guardar».</p>}
      <ul className="lista ancho">
        {lista.map((c) => (
          <li key={c.codigo} className="fila-socio">
            <Link to={`/carnet/${c.codigo}`} className="crece">
              <strong>🪪 {c.nombre}</strong>
            </Link>
            <button className="enlace" onClick={() => quitar(c.codigo)} aria-label={`Quitar ${c.nombre}`}>
              Quitar
            </button>
          </li>
        ))}
      </ul>
      <Link to="/" className="enlace tenue">
        Acceso para la junta y la taquilla
      </Link>
    </div>
  );
}

/** Botón de menú dibujado (el carácter ☰ no existe en las fuentes de algunos móviles) */
export function IconoMenu() {
  return (
    <>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </svg>
      <span>Menú</span>
    </>
  );
}

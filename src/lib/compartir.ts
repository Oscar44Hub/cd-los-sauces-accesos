/** Comparte un enlace con el menú del móvil (WhatsApp, email…) o lo copia. */
export async function compartirEnlace(titulo: string, texto: string, url: string): Promise<'compartido' | 'copiado'> {
  if (navigator.share) {
    try {
      await navigator.share({ title: titulo, text: texto, url });
      return 'compartido';
    } catch {
      /* cancelado: se copia */
    }
  }
  await navigator.clipboard.writeText(`${texto}\n${url}`);
  return 'copiado';
}

export function enlaceWhatsApp(texto: string, url: string, telefono?: string | null): string {
  const tel = (telefono ?? '').replace(/\D/g, '');
  const destino = tel ? (tel.length === 9 ? '34' + tel : tel) : '';
  return `https://wa.me/${destino}?text=${encodeURIComponent(`${texto}\n${url}`)}`;
}

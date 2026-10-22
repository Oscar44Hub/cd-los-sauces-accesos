/** Reduce la foto antes de subirla (las del móvil pesan varios MB). */
export async function prepararFoto(archivo: File, ladoMax = 600): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((ok, mal) =>
    canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo procesar la foto'))), 'image/jpeg', 0.85),
  );
}

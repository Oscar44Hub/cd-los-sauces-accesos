import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Las fotos están en un almacenamiento privado: se piden enlaces temporales y se reutilizan
const cache = new Map<string, { url: string; caduca: number }>();

export async function urlFoto(path: string): Promise<string | null> {
  const c = cache.get(path);
  if (c && c.caduca > Date.now()) return c.url;
  const { data } = await supabase.storage.from('fotos').createSignedUrl(path, 3600);
  if (!data) return null;
  cache.set(path, { url: data.signedUrl, caduca: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export function useFoto(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (path ? cache.get(path)?.url ?? null : null));
  useEffect(() => {
    let vivo = true;
    if (!path) {
      setUrl(null);
      return;
    }
    urlFoto(path).then((u) => vivo && setUrl(u));
    return () => {
      vivo = false;
    };
  }, [path]);
  return url;
}

export function olvidarFoto(path: string) {
  cache.delete(path);
}

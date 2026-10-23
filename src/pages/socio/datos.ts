import { supabase } from '../../lib/supabase';
import { ok, temporadaActiva } from '../../lib/datos';
import type { SocioCompleto } from '../../lib/tipos';
import type { CuotaConPagos } from '../../components/CuotaPagos';

/** La familia del socio con sus personas y cuotas (las políticas de la base de datos solo le dejan ver la suya) */
export async function miFamilia(socioId: number) {
  const [t, s] = await Promise.all([
    temporadaActiva(),
    supabase.from('socios').select('*, personas(*), cuotas(*, pagos(*), temporadas(nombre))').eq('id', socioId).single(),
  ]);
  const socio = ok(s) as Omit<SocioCompleto, 'cuotas'> & { cuotas: (CuotaConPagos & { temporadas: { nombre: string } })[] };
  const orden = ['titular', 'conyuge', 'abuelo', 'hijo', 'otro'];
  socio.personas.sort((a, b) => orden.indexOf(a.parentesco) - orden.indexOf(b.parentesco));
  return { t, socio };
}

import { describe, expect, it } from 'vitest';
import { edad, etiquetas, fecha, hoyISO, normalizar, sumarDias } from './formato';

describe('formato', () => {
  it('calcula la edad teniendo en cuenta si ya ha cumplido', () => {
    expect(edad('2015-07-10', '2026-07-09')).toBe(10);
    expect(edad('2015-07-10', '2026-07-10')).toBe(11);
    expect(edad(null)).toBeNull();
  });

  it('usa la fecha de España aunque en UTC sea otro día', () => {
    // 23:30 UTC del 30 de junio = 01:30 del 1 de julio en Madrid (horario de verano)
    expect(hoyISO(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07-01');
  });

  it('formatea fechas y suma días', () => {
    expect(fecha('2026-07-01')).toBe('01/07/2026');
    expect(sumarDias('2026-06-30', 1)).toBe('2026-07-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('genera las etiquetas de la persona', () => {
    expect(etiquetas({ es_fundador: true, es_jubilado: true, edad: 70 })).toEqual(['Fundador', 'Jubilado']);
    expect(etiquetas({ edad: 8 })).toEqual(['Menor de 14']);
  });

  it('busca sin acentos ni mayúsculas', () => {
    expect(normalizar('  GARCÍA Muñoz')).toBe('garcia munoz');
  });
});

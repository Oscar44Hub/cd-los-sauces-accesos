/**
 * Descarga una tabla como CSV que Excel abre directamente en español
 * (separador «;», coma decimal y BOM para que respete las tildes).
 */
export function descargarExcel(nombre: string, cabeceras: string[], filas: (string | number | null | undefined)[][]) {
  const celda = (v: string | number | null | undefined) => {
    if (v == null) return '';
    const t = typeof v === 'number' ? v.toLocaleString('es-ES', { useGrouping: false, maximumFractionDigits: 2 }) : v;
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const csv = [cabeceras, ...filas].map((f) => f.map(celda).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre.endsWith('.csv') ? nombre : `${nombre}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Lee planillas con bloques de áreas y encabezados DOMINGO 01 ... SABADO 07.
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
const normalizar = texto => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
function textoCelda(celda) {
  const valor = celda?.value;
  if (valor == null) return '';
  if (typeof valor === 'object') {
    if (valor.richText) return valor.richText.map(p => p.text).join('').trim();
    if (valor.text) return String(valor.text).trim();
    if (valor.result != null) return String(valor.result).trim();
    return '';
  }
  return String(valor).trim();
}
export async function leerPlanillaExcel(archivo) {
  if (!/\.xlsx$/i.test(archivo.name)) throw new Error('Selecciona un archivo .xlsx de Excel.');
  if (archivo.size > 5 * 1024 * 1024) throw new Error('El archivo supera el límite de 5 MB.');
  const { default: ExcelJS } = await import('exceljs');
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await archivo.arrayBuffer());
  const hoja = libro.worksheets[0];
  if (!hoja) throw new Error('El archivo no contiene hojas.');
  const filas = [];
  let area = '';
  let columnas = null;
  let encabezados = 0;
  hoja.eachRow({ includeEmpty: false }, fila => {
    const celdas = [];
    for (let i = 1; i <= Math.min(fila.cellCount, 30); i++) celdas.push(textoCelda(fila.getCell(i)));
    const cabecera = celdas.map(normalizar);
    const dias = DIAS.map(dia => cabecera.findIndex(v => v.startsWith(normalizar(dia))));
    if (dias.every(i => i >= 0) && new Set(dias).size === 7) {
      area = celdas[0]?.trim() || '';
      columnas = dias;
      encabezados++;
      return;
    }
    if (!columnas || !area || !celdas[0]?.trim()) return;
    const nombre = celdas[0].trim();
    const cargo = (celdas[1] || 'MESERO').trim();
    if (/^(EVENTOS?|MESEROS?|CARGO|TOTAL|OBSERVACIONES?)$/i.test(normalizar(nombre))) return;
    const turnos = {};
    DIAS.forEach((dia, i) => {
      const valor = (celdas[columnas[i]] || '').trim();
      if (valor) turnos[dia] = valor;
    });
    if (Object.keys(turnos).length) filas.push({ area, nombre, cargo, turnos });
  });
  if (!encabezados || !filas.length) throw new Error('No se encontraron bloques con los siete días de domingo a sábado y sus meseros.');
  if (filas.length > 300) throw new Error('Solo se permiten hasta 300 meseros por importación.');
  return filas;
}

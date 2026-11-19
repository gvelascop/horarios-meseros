import { DIAS, anchoColumna, fechaDeDia, parsearFecha } from './horariosUtils';

export async function descargarExcel({ semana, areas, trabajadores, obtenerHorario, obtenerAreaSemana, ordenarPersonalSemana, obtenerCargoSemana, totalHoras, setMensaje }) {
    try {
      const { default: ExcelJS } = await import('exceljs');
      const libro = new ExcelJS.Workbook();
      libro.creator = 'Control de horarios';
      libro.created = new Date();

      const hoja = libro.addWorksheet('Horarios', {
        properties: { defaultRowHeight: 19 },
        views: [{ state: 'frozen', ySplit: 4, xSplit: 2, showGridLines: false, zoomScale: 75, zoomScaleNormal: 75 }],
        pageSetup: {
          paperSize: 9,
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: {
            left: 0.25,
            right: 0.25,
            top: 0.5,
            bottom: 0.5,
            header: 0.2,
            footer: 0.2
          }
        }
      });

      hoja.columns = [
        { key: 'trabajador', width: 23 },
        { key: 'cargo', width: 13 },
        ...DIAS.map(dia => ({
          width: Math.min(15, Math.max(11, anchoColumna(
            trabajadores.map(trabajador => obtenerHorario(trabajador.id, dia.clave)),
            12
          )))
        })),
        { key: 'total', width: 11 }
      ];

      hoja.mergeCells('A1:J1');
      const titulo = hoja.getCell('A1');
      titulo.value = 'CONTROL DE HORARIOS';
      titulo.font = { name: 'Aptos Display', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
      titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF124E4C' } };
      titulo.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      hoja.getRow(1).height = 28;

      const ultimoDia = fechaDeDia(semana, 6);
      hoja.mergeCells('A2:J2');
      const subtitulo = hoja.getCell('A2');
      subtitulo.value = `PROGRAMACIÓN SEMANAL  ·  ${parsearFecha(semana).toLocaleDateString('es-CO')} – ${ultimoDia.toLocaleDateString('es-CO')}`;
      subtitulo.font = { name: 'Aptos', size: 9, color: { argb: 'FF536966' } };
      subtitulo.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      hoja.getRow(2).height = 20;
      hoja.getRow(3).height = 5;

      const filaEncabezado = hoja.addRow([
        'MESEROS',
        'CARGO',
        ...DIAS.map(dia => `${dia.titulo} · ${fechaDeDia(semana, dia.desplazamiento).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })}`),
        'TOTAL HORAS'
      ]);
      filaEncabezado.height = 26;
      filaEncabezado.eachCell(cell => {
        cell.font = { name: 'Aptos', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17615C' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { bottom: { style: 'medium', color: { argb: 'FF124E4C' } } };
      });

      for (const area of areas) {
        const filaArea = hoja.addRow([area.nombre]);
        const numeroFilaArea = filaArea.number;
        hoja.mergeCells(numeroFilaArea, 1, numeroFilaArea, 10);
        const celdaArea = hoja.getCell(numeroFilaArea, 1);
        celdaArea.font = { name: 'Aptos', size: 9, bold: true, color: { argb: 'FF124E4C' } };
        celdaArea.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF5EF' } };
        celdaArea.alignment = { vertical: 'middle', indent: 1 };
        celdaArea.border = { bottom: { style: 'thin', color: { argb: 'FFD7E9E2' } } };
        filaArea.height = 21;

        const personal = trabajadores.filter(
          trabajador => obtenerAreaSemana(trabajador) === Number(area.id)
        ).sort(ordenarPersonalSemana);

        for (const trabajador of personal) {
          const fila = hoja.addRow([
            trabajador.nombre,
            obtenerCargoSemana(trabajador),
            ...DIAS.map(dia => obtenerHorario(trabajador.id, dia.clave)),
            `${totalHoras(trabajador.id)} h`
          ]);
          fila.height = 21;

          fila.eachCell((cell, numeroColumna) => {
            cell.font = {
              name: 'Aptos',
              size: 9,
              bold: numeroColumna === 10,
              color: { argb: numeroColumna === 10 ? 'FF124E4C' : 'FF263D3F' }
            };
            cell.alignment = {
              vertical: 'middle',
              horizontal: numeroColumna === 1 ? 'left' : 'center',
              indent: numeroColumna === 1 ? 1 : 0,
              wrapText: numeroColumna >= 3 && numeroColumna <= 9
            };
            cell.border = {
              bottom: { style: 'thin', color: { argb: 'FFE8EEEB' } }
            };

            if (numeroColumna === 10) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF7F2' } };
            } else if (numeroColumna === 2) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F7F5' } };
            } else if (numeroColumna >= 3 && numeroColumna <= 9) {
              const estado = String(cell.value).trim().toUpperCase();
              const coloresEstado = {
                DESCANSO: ['FFFFF1C9', 'FF634000'],
                COMPENSATORIO: ['FFFFF1C9', 'FF634000'],
                INCAPACIDAD: ['FFFCE4DD', 'FF793827'],
                LICENCIA: ['FFF8DFEB', 'FF71314F'],
                LIBRE: ['FFF1F4F3', 'FF596966']
              };
              const colores = coloresEstado[estado];
              if (colores) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores[0] } };
                cell.font = {
                  name: 'Aptos',
                  size: 9,
                  bold: estado !== 'LIBRE',
                  color: { argb: colores[1] }
                };
              } else if (fila.number % 2 === 0) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAF9' } };
              }
            } else if (fila.number % 2 === 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAF9' } };
            }
          });
        }
      }

      const contenido = await libro.xlsx.writeBuffer();
      const archivo = new Blob([contenido], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `horarios-semana-${semana}.xlsx`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMensaje('Plantilla de Excel descargada correctamente');
    } catch (error) {
      console.error('Error al generar la plantilla de Excel:', error);
      setMensaje(`No se pudo generar el archivo de Excel: ${error.message}`);
    }
  }


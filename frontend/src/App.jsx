import React, { useEffect, useState } from 'react';
import './App.css';

const API = 'http://localhost:3000/api';

const DIAS = [
  { clave: 'Domingo', titulo: 'DOM', desplazamiento: -1 },
  { clave: 'Lunes', titulo: 'LUN', desplazamiento: 0 },
  { clave: 'Martes', titulo: 'MAR', desplazamiento: 1 },
  { clave: 'Miercoles', titulo: 'MIÉ', desplazamiento: 2 },
  { clave: 'Jueves', titulo: 'JUE', desplazamiento: 3 },
  { clave: 'Viernes', titulo: 'VIE', desplazamiento: 4 },
  { clave: 'Sabado', titulo: 'SÁB', desplazamiento: 5 }
];

function fechaLocal(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function parsearFecha(texto) {
  const [anio, mes, dia] = texto.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

function obtenerLunes(fecha = new Date()) {
  const copia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  copia.setDate(copia.getDate() - ((copia.getDay() + 6) % 7));
  return fechaLocal(copia);
}

function fechaDeDia(lunes, desplazamiento) {
  const fecha = parsearFecha(lunes);
  fecha.setDate(fecha.getDate() + desplazamiento);
  return fecha;
}

function minutosHora(texto) {
  const partes = texto.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!partes) return null;

  let hora = Number(partes[1]);
  const minutos = Number(partes[2] || 0);
  const periodo = partes[3]?.toUpperCase();

  if (minutos > 59) return null;

  if (periodo) {
    if (hora < 1 || hora > 12) return null;
    hora = (hora % 12) + (periodo === 'PM' ? 12 : 0);
  } else if (hora > 23) {
    return null;
  }

  return hora * 60 + minutos;
}


function calcularHoras(horario) {
    if (!horario || typeof horario !== 'string') {
        return 0;
    }

    const texto = horario.trim().toUpperCase();

    const estados = [
        'LIBRE',
        'DESCANSO',
        'COMPENSATORIO',
        'INCAPACIDAD',
        'LICENCIA'
    ];

    if (estados.includes(texto)) {
        return 0;
    }

    // Convierte horas escritas con o sin dos puntos.
    function convertirHora(valor) {
        const limpio = valor
            .trim()
            .toUpperCase()
            .replace(/\s+/g, '');

        const coincidencia = limpio.match(
            /^(\d{1,4})(?::(\d{2}))?(AM|PM)?$/
        );

        if (!coincidencia) {
            return null;
        }

        const numeros = coincidencia[1];
        const minutosExplicitos = coincidencia[2];
        const periodo = coincidencia[3];

        let horas;
        let minutos;

        if (minutosExplicitos !== undefined) {
            horas = Number(numeros);
            minutos = Number(minutosExplicitos);
        } else if (numeros.length >= 3) {
            horas = Number(numeros.slice(0, -2));
            minutos = Number(numeros.slice(-2));
        } else {
            horas = Number(numeros);
            minutos = 0;
        }

        if (minutos > 59) {
            return null;
        }

        if (periodo) {
            if (horas < 1 || horas > 12) {
                return null;
            }

            if (periodo === 'AM') {
                horas = horas === 12 ? 0 : horas;
            } else {
                horas = horas === 12 ? 12 : horas + 12;
            }
        } else {
            if (horas < 0 || horas > 23) {
                return null;
            }
        }

        return horas * 60 + minutos;
    }

    // Separar la hora de entrada y salida.
    const partes = texto.split(/\s*[-–—]\s*/);

    if (partes.length !== 2) {
        return 0;
    }

    const entrada = convertirHora(partes[0]);
    const salida = convertirHora(partes[1]);

    if (entrada === null || salida === null) {
        return 0;
    }

    let diferencia = salida - entrada;

    // Turnos que terminan al día siguiente.
    if (diferencia < 0) {
        diferencia += 24 * 60;
    }

    // No contar fracciones de hora.
    return Math.floor(diferencia / 60);
}


function claseHorario(valor) {
  const texto = String(valor || '').trim().toUpperCase();
  const clases = {
    DESCANSO: 'celda-descanso',
    COMPENSATORIO: 'celda-compensatorio',
    INCAPACIDAD: 'celda-incapacidad',
    LICENCIA: 'celda-licencia',
    LIBRE: 'celda-libre'
  };
  return clases[texto] || '';
}

function App() {
  const [areas, setAreas] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [semana, setSemana] = useState(obtenerLunes());
  const [semanaCargada, setSemanaCargada] = useState(null);
  const [nuevasAreas, setNuevasAreas] = useState({});
  const [nuevosTrabajadores, setNuevosTrabajadores] = useState({});
  const [mensaje, setMensaje] = useState('');
  const [vista, setVista] = useState('horarios');
  const [estadisticas, setEstadisticas] = useState([]);
  const [cargandoEstadisticas, setCargandoEstadisticas] = useState(false);
  const [errorEstadisticas, setErrorEstadisticas] = useState('');

  async function pedirJson(url, opciones) {
    const respuesta = await fetch(url, opciones);
    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      throw new Error(datos.mensaje || datos.error || 'Error del servidor');
    }

    return datos;
  }

  function opcionesJson(method, body) {
    return {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    };
  }

  async function cargarDatos() {
    try {
      const [listaAreas, listaTrabajadores] = await Promise.all([
        pedirJson(`${API}/areas`),
        pedirJson(`${API}/trabajadores`)
      ]);

      setAreas(listaAreas);
      setTrabajadores(listaTrabajadores);
    } catch (error) {
      setMensaje(`Error al cargar áreas o trabajadores: ${error.message}`);
    }
  }

  async function cargarEstadisticas() {
    setCargandoEstadisticas(true);
    setErrorEstadisticas('');

    try {
      const datos = await pedirJson(`${API}/estadisticas/meseros-por-area`);
      setEstadisticas(datos);
    } catch (error) {
      setErrorEstadisticas(error.message);
    } finally {
      setCargandoEstadisticas(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    let vigente = true;
    setSemanaCargada(null);
    setHorarios([]);

    pedirJson(`${API}/horarios?semana_inicio=${semana}`)
      .then(datos => {
        if (!vigente) return;
        setHorarios(datos);
        setSemanaCargada(semana);
      })
      .catch(error => {
        if (vigente) setMensaje(`Error al cargar horarios: ${error.message}`);
      });

    return () => {
      vigente = false;
    };
  }, [semana]);

  async function agregarArea(evento) {
    evento.preventDefault();
    const nombre = (nuevasAreas.inicio || '').trim();
    if (!nombre) return;

    try {
      await pedirJson(`${API}/areas`, opcionesJson('POST', { nombre }));
      setNuevasAreas(actual => ({ ...actual, inicio: '' }));
      await cargarDatos();
      setMensaje('Área agregada correctamente');
    } catch (error) {
      setMensaje(`No se pudo agregar el área: ${error.message}`);
    }
  }

  async function agregarTrabajador(evento, areaId) {
    evento.preventDefault();
    const nombre = (nuevosTrabajadores[areaId] || '').trim();
    if (!nombre) return;

    try {
      await pedirJson(`${API}/trabajadores`, opcionesJson('POST', {
        nombre,
        area_id: areaId,
        cargo: 'MESERO'
      }));

      setNuevosTrabajadores(actual => ({ ...actual, [areaId]: '' }));
      await cargarDatos();
      setMensaje('Trabajador agregado correctamente');
    } catch (error) {
      setMensaje(`No se pudo agregar el trabajador: ${error.message}`);
    }
  }

  async function editarArea(area, valor) {
    const nombre = valor.trim();
    if (!nombre || nombre === area.nombre) return;

    try {
      await pedirJson(`${API}/areas/${area.id}`, opcionesJson('PUT', { nombre }));
      setAreas(actual => actual.map(item =>
        Number(item.id) === Number(area.id) ? { ...item, nombre } : item
      ));
    } catch (error) {
      setMensaje(`No se pudo editar el área: ${error.message}`);
    }
  }

  async function editarTrabajador(trabajador, campo, valor) {
    const limpio = valor.trim();
    if (!limpio || limpio === (trabajador[campo] || '')) return;

    const actualizado = { ...trabajador, [campo]: limpio };

    try {
      await pedirJson(`${API}/trabajadores/${trabajador.id}`, opcionesJson('PUT', {
        nombre: actualizado.nombre,
        area_id: actualizado.area_id,
        cargo: actualizado.cargo || 'MESERO'
      }));

      setTrabajadores(actual => actual.map(item =>
        Number(item.id) === Number(trabajador.id) ? actualizado : item
      ));
    } catch (error) {
      setMensaje(`No se pudo editar el trabajador: ${error.message}`);
    }
  }

  function obtenerHorario(trabajadorId, dia) {
    const encontrado = horarios.find(item =>
      Number(item.trabajador_id) === Number(trabajadorId) &&
      item.dia_semana === dia
    );

    return encontrado?.horario || 'LIBRE';
  }

  async function guardarHorario(trabajadorId, dia, valor) {
    if (semanaCargada !== semana) return;

    const horario = valor.trim() || 'LIBRE';
    if (horario === obtenerHorario(trabajadorId, dia)) return;

    try {
      await pedirJson(`${API}/horarios`, opcionesJson('POST', {
        trabajador_id: trabajadorId,
        semana_inicio: semana,
        dia_semana: dia,
        horario
      }));

      setHorarios(actual => {
        const otros = actual.filter(item => !(
          Number(item.trabajador_id) === Number(trabajadorId) &&
          item.dia_semana === dia
        ));

        return [...otros, { trabajador_id: trabajadorId, dia_semana: dia, horario }];
      });
    } catch (error) {
      setMensaje(`No se pudo guardar el horario: ${error.message}`);
    }
  }

  function totalHoras(trabajadorId) {
    return DIAS.reduce((total, dia) =>
      total + calcularHoras(obtenerHorario(trabajadorId, dia.clave)), 0
    );
  }

  async function descargarExcel() {
    if (cargando) return;

    try {
      const { default: ExcelJS } = await import('exceljs');
      const libro = new ExcelJS.Workbook();
      libro.creator = 'Control de horarios';
      libro.created = new Date();

      const hoja = libro.addWorksheet('Horarios', {
        properties: { defaultRowHeight: 24 },
        views: [{ state: 'frozen', ySplit: 4, xSplit: 2, showGridLines: false }],
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
        { key: 'trabajador', width: 30 },
        { key: 'cargo', width: 17 },
        ...DIAS.map(() => ({ width: 18 })),
        { key: 'total', width: 15 }
      ];

      hoja.mergeCells('A1:J1');
      const titulo = hoja.getCell('A1');
      titulo.value = 'CONTROL DE HORARIOS';
      titulo.font = { name: 'Aptos Display', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
      titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF124E4C' } };
      titulo.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      hoja.getRow(1).height = 38;

      const ultimoDia = fechaDeDia(semana, 6);
      hoja.mergeCells('A2:J2');
      const subtitulo = hoja.getCell('A2');
      subtitulo.value = `PROGRAMACIÓN SEMANAL  ·  ${parsearFecha(semana).toLocaleDateString('es-CO')} – ${ultimoDia.toLocaleDateString('es-CO')}`;
      subtitulo.font = { name: 'Aptos', size: 11, color: { argb: 'FF536966' } };
      subtitulo.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      hoja.getRow(2).height = 25;
      hoja.getRow(3).height = 10;

      const filaEncabezado = hoja.addRow([
        'MESEROS',
        'CARGO',
        ...DIAS.map(dia => `${dia.titulo} · ${fechaDeDia(semana, dia.desplazamiento).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })}`),
        'TOTAL HORAS'
      ]);
      filaEncabezado.height = 32;
      filaEncabezado.eachCell(cell => {
        cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17615C' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { bottom: { style: 'medium', color: { argb: 'FF124E4C' } } };
      });

      for (const area of areas) {
        const filaArea = hoja.addRow([area.nombre]);
        const numeroFilaArea = filaArea.number;
        hoja.mergeCells(numeroFilaArea, 1, numeroFilaArea, 10);
        const celdaArea = hoja.getCell(numeroFilaArea, 1);
        celdaArea.font = { name: 'Aptos', size: 11, bold: true, color: { argb: 'FF124E4C' } };
        celdaArea.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF5EF' } };
        celdaArea.alignment = { vertical: 'middle', indent: 1 };
        celdaArea.border = { bottom: { style: 'thin', color: { argb: 'FFD7E9E2' } } };
        filaArea.height = 27;

        const personal = trabajadores.filter(
          trabajador => Number(trabajador.area_id) === Number(area.id)
        );

        for (const trabajador of personal) {
          const fila = hoja.addRow([
            trabajador.nombre,
            trabajador.cargo || 'MESERO',
            ...DIAS.map(dia => obtenerHorario(trabajador.id, dia.clave)),
            `${totalHoras(trabajador.id)} h`
          ]);
          fila.height = 25;

          fila.eachCell((cell, numeroColumna) => {
            cell.font = {
              name: 'Aptos',
              size: 10,
              bold: numeroColumna === 10,
              color: { argb: numeroColumna === 10 ? 'FF124E4C' : 'FF263D3F' }
            };
            cell.alignment = {
              vertical: 'middle',
              horizontal: numeroColumna === 1 ? 'left' : 'center',
              indent: numeroColumna === 1 ? 1 : 0
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
                COMPENSATORIO: ['FFE7F2FF', 'FF23486F'],
                INCAPACIDAD: ['FFFCE4DD', 'FF793827'],
                LICENCIA: ['FFF8DFEB', 'FF71314F'],
                LIBRE: ['FFF1F4F3', 'FF596966']
              };
              const colores = coloresEstado[estado];
              if (colores) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores[0] } };
                cell.font = {
                  name: 'Aptos',
                  size: 10,
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

  function enterGuarda(evento) {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      evento.currentTarget.blur();
    }
  }

  function cambiarSemana(cantidadDias) {
    const fecha = parsearFecha(semana);
    fecha.setDate(fecha.getDate() + cantidadDias);
    setSemana(fechaLocal(fecha));
  }

  const cargando = semanaCargada !== semana;
  const areasEstadisticas = [...new Set(estadisticas.map(item => item.area_id))]
    .map(areaId => {
      const meseros = estadisticas.filter(item => item.area_id === areaId);
      return {
        areaId,
        area: meseros[0].area,
        meseros
      };
    });
  const totalDiasTrabajados = estadisticas.reduce(
    (total, item) => total + Number(item.dias_trabajados),
    0
  );

  return (
    <div className="aplicacion">
      <header className="encabezado">
        <div>
          <h1>CONTROL DE HORARIOS</h1>
          <p>Programación semanal del personal</p>
        </div>
        <span className="indicador">Planilla de meseros</span>
      </header>

      <main className="contenido">
        <nav className="navegacion-vistas" aria-label="Secciones principales">
          <button
            type="button"
            className={vista === 'horarios' ? 'vista-activa' : ''}
            aria-current={vista === 'horarios' ? 'page' : undefined}
            onClick={() => setVista('horarios')}
          >
            Programación
          </button>
          <button
            type="button"
            className={vista === 'estadisticas' ? 'vista-activa' : ''}
            aria-current={vista === 'estadisticas' ? 'page' : undefined}
            onClick={() => {
              setVista('estadisticas');
              cargarEstadisticas();
            }}
          >
            Estadísticas
          </button>
        </nav>

        {vista === 'horarios' ? (
        <section className="panel">
          <div className="titulo-horarios">
            <div>
              <h2>PROGRAMACIÓN DE TURNOS</h2>
              <p>Edita cada celda y presiona Enter para guardar</p>
            </div>

            <div className="selector-semana">
              <label htmlFor="semana">Semana (lunes)</label>
              <input
                id="semana"
                type="date"
                value={semana}
                onChange={evento => {
                  if (evento.target.value) {
                    setSemana(obtenerLunes(parsearFecha(evento.target.value)));
                  }
                }}
              />
              <button type="button" onClick={() => cambiarSemana(-7)}>←</button>
              <button type="button" onClick={() => cambiarSemana(7)}>→</button>
              <button
                type="button"
                className="boton-excel"
                onClick={descargarExcel}
                disabled={cargando}
                title="Descargar la semana seleccionada en Excel"
              >
                <span aria-hidden="true">↓</span>
                Descargar Excel
              </button>
            </div>
          </div>

          <div className="tabla-contenedor">
            <table className="tabla-horarios">
              <thead>
                <tr>
                  <th className="columna-trabajador">MESEROS</th>
                  <th className="columna-cargo">CARGO</th>
                  {DIAS.map(dia => (
                    <th key={dia.clave} className="encabezado-dia">
                      <span>{dia.titulo}</span>
                      <span className="fecha-dia">
                        {fechaDeDia(semana, dia.desplazamiento).toLocaleDateString(
                          'es-CO',
                          { day: '2-digit', month: '2-digit' }
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="columna-total">TOTAL HORAS</th>
                </tr>
              </thead>

              <tbody>
                {areas.map(area => {
                  const personal = trabajadores.filter(trabajador =>
                    Number(trabajador.area_id) === Number(area.id)
                  );

                  return (
                    <React.Fragment key={area.id}>
                      <tr className="fila-area">
                        <td colSpan={10}>
                          <input
                            className="nombre-editable"
                            aria-label={`Editar área ${area.nombre}`}
                            key={`${area.id}-${area.nombre}`}
                            defaultValue={area.nombre}
                            onKeyDown={enterGuarda}
                            onBlur={evento => editarArea(area, evento.target.value)}
                          />
                        </td>
                      </tr>

                      {personal.map(trabajador => (
                        <tr className="fila-trabajador" key={trabajador.id}>
                          <td className="nombre-trabajador">
                            <input
                              className="nombre-editable"
                              aria-label={`Editar nombre de ${trabajador.nombre}`}
                              key={`${trabajador.id}-${trabajador.nombre}`}
                              defaultValue={trabajador.nombre}
                              onKeyDown={enterGuarda}
                              onBlur={evento => editarTrabajador(
                                trabajador, 'nombre', evento.target.value
                              )}
                            />
                          </td>

                          <td className="celda-cargo">
                            <input
                              className="cargo-editable"
                              aria-label={`Cargo de ${trabajador.nombre}`}
                              key={`${trabajador.id}-${trabajador.cargo}`}
                              defaultValue={trabajador.cargo || 'MESERO'}
                              onKeyDown={enterGuarda}
                              onBlur={evento => editarTrabajador(
                                trabajador, 'cargo', evento.target.value
                              )}
                            />
                          </td>

                          {DIAS.map(dia => {
                            const valor = cargando
                              ? ''
                              : obtenerHorario(trabajador.id, dia.clave);

                            return (
                              <td className="celda" key={dia.clave}>
                                <input
                                  className={`celda-horario ${claseHorario(valor)}`}
                                  aria-label={`Horario de ${trabajador.nombre} el ${dia.clave}`}
                                  key={`${trabajador.id}-${dia.clave}-${semana}-${valor}`}
                                  defaultValue={valor}
                                  disabled={cargando}
                                  onKeyDown={enterGuarda}
                                  onBlur={evento => guardarHorario(
                                    trabajador.id, dia.clave, evento.target.value
                                  )}
                                />
                              </td>
                            );
                          })}

                          <td className="total-horas">
                            {cargando ? '...' : `${totalHoras(trabajador.id)} h`}
                          </td>
                        </tr>
                      ))}

                      <tr className="fila-agregar">
                        <td colSpan={10}>
                          <form
                            className="form-agregar"
                            onSubmit={evento => agregarTrabajador(evento, area.id)}
                          >
                            <input
                              type="text"
                              aria-label={`Agregar trabajador en ${area.nombre}`}
                              placeholder="+ Escribir trabajador y presionar Enter"
                              value={nuevosTrabajadores[area.id] || ''}
                              onChange={evento => setNuevosTrabajadores(actual => ({
                                ...actual,
                                [area.id]: evento.target.value
                              }))}
                            />
                          </form>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}

              </tbody>
            </table>
          </div>

          <div className="agregar-area">
            <span className="icono-nueva-area" aria-hidden="true">+</span>
            <div className="agregar-area-copy">
              <strong>¿Necesitas otra sección?</strong>
              <span>Crea un área para organizar al equipo.</span>
            </div>
            <form
              className="form-nueva-area"
              onSubmit={evento => agregarArea(evento)}
            >
              <input
                type="text"
                aria-label="Nombre de la nueva área"
                placeholder="Ej. Terraza"
                value={nuevasAreas.inicio || ''}
                onChange={evento => setNuevasAreas(actual => ({
                  ...actual,
                  inicio: evento.target.value
                }))}
              />
              <button type="submit">Agregar área</button>
            </form>
          </div>

          <p className="ayuda">
            Turnos: 8:00 AM - 4:30 PM · DESCANSO · COMPENSATORIO ·
            INCAPACIDAD · LICENCIA. Las medias horas no se suman al total.
          </p>

          {mensaje && (
            <div className="mensaje" role="alert">
              <span>{mensaje}</span>
              <button type="button" onClick={() => setMensaje('')}>
                Cerrar
              </button>
            </div>
          )}
        </section>
        ) : (
          <section className="panel panel-estadisticas">
            <div className="encabezado-estadisticas">
              <div>
                <span className="eyebrow-estadisticas">RESUMEN DEL EQUIPO</span>
                <h2>Días trabajados por área</h2>
                <p>
                  Consulta cuántos días con turno tiene registrados cada mesero en cada área.
                </p>
              </div>
              <button
                type="button"
                className="boton-actualizar"
                onClick={cargarEstadisticas}
                disabled={cargandoEstadisticas}
              >
                {cargandoEstadisticas ? 'Actualizando…' : 'Actualizar'}
              </button>
            </div>

            <p className="nota-estadisticas">
              No se cuentan días libres, descansos, incapacidades, licencias ni compensatorios.
              Los horarios anteriores a la actualización se asociarán al área actual del mesero.
            </p>

            {cargandoEstadisticas ? (
              <div className="estado-estadisticas">Cargando estadísticas…</div>
            ) : errorEstadisticas ? (
              <div className="mensaje mensaje-error-estadisticas" role="alert">
                No se pudieron cargar las estadísticas: {errorEstadisticas}
              </div>
            ) : estadisticas.length === 0 ? (
              <div className="estado-estadisticas">
                Todavía no hay meseros o turnos registrados para mostrar.
              </div>
            ) : (
              <>
                <div className="resumen-estadisticas">
                  <article className="tarjeta-resumen">
                    <span>Días con turno</span>
                    <strong>{totalDiasTrabajados.toLocaleString('es-CO')}</strong>
                    <small>En todas las áreas</small>
                  </article>
                  <article className="tarjeta-resumen">
                    <span>Áreas con personal</span>
                    <strong>{areasEstadisticas.length}</strong>
                    <small>Con historial o meseros activos</small>
                  </article>
                </div>

                <div className="grafico-areas">
                  {areasEstadisticas.map(grupo => {
                    const totalArea = grupo.meseros.reduce(
                      (total, item) => total + Number(item.dias_trabajados),
                      0
                    );
                    const maxDias = Math.max(
                      1,
                      ...grupo.meseros.map(item => Number(item.dias_trabajados))
                    );

                    return (
                      <article className="tarjeta-grafico-area" key={grupo.areaId}>
                        <header>
                          <div>
                            <span className="etiqueta-area">ÁREA</span>
                            <h3>{grupo.area}</h3>
                          </div>
                          <span className="total-area">
                            {totalArea} {totalArea === 1 ? 'día' : 'días'}
                          </span>
                        </header>

                        <ol className="lista-barras">
                          {grupo.meseros.map(item => {
                            const dias = Number(item.dias_trabajados);
                            const proporcion = (dias / maxDias) * 100;

                            return (
                              <li key={`${grupo.areaId}-${item.trabajador_id}`}>
                                <div className="detalle-barra">
                                  <span>{item.trabajador}</span>
                                  <strong>{dias} {dias === 1 ? 'día' : 'días'}</strong>
                                </div>
                                <div
                                  className="pista-barra"
                                  role="img"
                                  aria-label={`${item.trabajador}: ${dias} ${dias === 1 ? 'día' : 'días'} trabajados en ${grupo.area}`}
                                >
                                  <span style={{ width: `${proporcion}%` }} />
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;

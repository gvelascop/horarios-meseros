import React, { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { apiJson } from './api';

const API = '/api';
const CLAVE_NAVEGACION = 'horarios:navegacion:v1';

function leerNavegacion() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE_NAVEGACION));
    return datos && typeof datos === 'object' ? datos : {};
  } catch {
    return {};
  }
}

function guardarNavegacion(cambios) {
  try {
    localStorage.setItem(CLAVE_NAVEGACION, JSON.stringify({ ...leerNavegacion(), ...cambios }));
  } catch {
    // La app sigue funcionando si el navegador no permite almacenamiento.
  }
}

const pedirJson = apiJson;

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
    const partes = texto.match(
        /^\s*(\d{1,4}(?::\d{2})?\s*(?:AM|PM)?)\s*[-–—]\s*(\d{1,4}(?::\d{2})?\s*(?:AM|PM)?)/i
    );

    if (!partes) {
        return 0;
    }

    const entrada = convertirHora(partes[1]);
    const salida = convertirHora(partes[2]);

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

function anchoColumna(valores, minimo) {
  return valores.reduce(
    (ancho, valor) => Math.min(
      26,
      Math.max(ancho, String(valor || '').length + 2)
    ),
    minimo
  );
}

function ajustarAlturaCeldaHorario(celda) {
  if (!celda) return;
  celda.style.height = 'auto';
  celda.style.height = `${celda.scrollHeight}px`;
}


function prioridadCargo(cargo) {
  const normalizado = String(cargo || '').trim().toUpperCase().replace(/[\s_-]+/g, '');
  if (normalizado === 'BARMAN') return 0;
  if (normalizado === 'AUXBARMAN' || normalizado === 'AUXILIARBARMAN' || normalizado === 'AUXILIARDEBARMAN') return 1;
  return 2;
}

function ordenarPorCargo(a, b) {
  return prioridadCargo(a.cargo) - prioridadCargo(b.cargo);
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
  const [datosCargados, setDatosCargados] = useState(false);
  const [trabajadores, setTrabajadores] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [semana, setSemana] = useState(() => {
    const guardada = leerNavegacion().semana;
    if (typeof guardada !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(guardada)) return obtenerLunes();
    const fecha = parsearFecha(guardada);
    return fechaLocal(fecha) === guardada ? obtenerLunes(fecha) : obtenerLunes();
  });
  const [semanaCargada, setSemanaCargada] = useState(null);
  const [nuevasAreas, setNuevasAreas] = useState({});
  const [nuevosTrabajadores, setNuevosTrabajadores] = useState({});
  const [mensaje, setMensaje] = useState('');
  const [trabajadorEliminado, setTrabajadorEliminado] = useState(null);
  const deshaciendoEliminacion = useRef(false);
  const eliminandoAreas = useRef(new Set());
  const [vista, setVista] = useState(() => leerNavegacion().vista === 'estadisticas' ? 'estadisticas' : 'horarios');
  const [estadisticas, setEstadisticas] = useState([]);
  const [cargandoEstadisticas, setCargandoEstadisticas] = useState(() => leerNavegacion().vista === 'estadisticas');
  const [errorEstadisticas, setErrorEstadisticas] = useState('');

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
      setDatosCargados(true);
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
    let vigente = true;
    Promise.all([pedirJson(`${API}/areas`), pedirJson(`${API}/trabajadores`)])
      .then(([listaAreas, listaTrabajadores]) => {
        if (!vigente) return;
        setAreas(listaAreas);
        setTrabajadores(listaTrabajadores);
        setDatosCargados(true);
      }).catch(error => { if (vigente) setMensaje(error.message); });
    if (leerNavegacion().vista === 'estadisticas') {
      pedirJson(`${API}/estadisticas/meseros-por-area`)
        .then(datos => { if (vigente) setEstadisticas(datos); })
        .catch(error => { if (vigente) setErrorEstadisticas(error.message); })
        .finally(() => { if (vigente) setCargandoEstadisticas(false); });
    }
    return () => { vigente = false; };
  }, []);

  useEffect(() => {
    let vigente = true;
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

  const posicionRestaurada = useRef(null);

  useEffect(() => {
    guardarNavegacion({ vista, semana });
  }, [vista, semana]);

  useEffect(() => {
    const clave = vista + ':' + semana;
    if (posicionRestaurada.current === clave) return;
    if (vista === 'horarios' && (semanaCargada !== semana || !datosCargados)) return;
    if (vista === 'estadisticas' && cargandoEstadisticas) return;
    const posiciones = leerNavegacion().posiciones || {};
    const posicion = posiciones[clave] || {};
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ left: Number(posicion.x) || 0, top: Number(posicion.y) || 0, behavior: 'instant' });
      const tabla = document.querySelector('.tabla-contenedor');
      if (tabla) {
        tabla.scrollLeft = Number(posicion.tablaX) || 0;
        tabla.scrollTop = Number(posicion.tablaY) || 0;
      }
      posicionRestaurada.current = clave;
    });
    return () => cancelAnimationFrame(frame);
  }, [vista, semana, semanaCargada, datosCargados, cargandoEstadisticas, areas.length, trabajadores.length, estadisticas.length]);

  useEffect(() => {
    const clave = vista + ':' + semana;
    function guardarPosicion() {
      if (posicionRestaurada.current !== clave) return;
      const tabla = document.querySelector('.tabla-contenedor');
      const posiciones = leerNavegacion().posiciones || {};
      guardarNavegacion({ posiciones: { ...posiciones, [clave]: {
        x: window.scrollX, y: window.scrollY,
        tablaX: tabla?.scrollLeft || 0, tablaY: tabla?.scrollTop || 0
      } } });
    }
    window.addEventListener('scroll', guardarPosicion, true);
    window.addEventListener('pagehide', guardarPosicion);
    return () => {
      window.removeEventListener('scroll', guardarPosicion, true);
      window.removeEventListener('pagehide', guardarPosicion);
    };
  }, [vista, semana]);

  const deshacerEliminacion = useCallback(async () => {
    if (!trabajadorEliminado || deshaciendoEliminacion.current) return;

    deshaciendoEliminacion.current = true;
    let restaurado = false;
    try {
      await pedirJson(
        `${API}/trabajadores/${trabajadorEliminado.id}/reactivar`,
        { method: 'POST' }
      );
      setTrabajadores(actual => [
        ...actual.filter(item => Number(item.id) !== Number(trabajadorEliminado.id)),
        trabajadorEliminado
      ].sort((a, b) => Number(a.id) - Number(b.id)));
      setTrabajadorEliminado(null);
      setMensaje(`${trabajadorEliminado.nombre} fue restaurado en la tabla`);
      restaurado = true;
    } catch (error) {
      setMensaje(`No se pudo restaurar al mesero: ${error.message}`);
    } finally {
      if (!restaurado) deshaciendoEliminacion.current = false;
    }
  }, [trabajadorEliminado]);

  useEffect(() => {
    function manejarAtajoDeshacer(evento) {
      if (!(evento.ctrlKey || evento.metaKey) || evento.key.toLowerCase() !== 'z') return;
      if (!trabajadorEliminado) return;

      evento.preventDefault();
      deshacerEliminacion();
    }

    window.addEventListener('keydown', manejarAtajoDeshacer);
    return () => window.removeEventListener('keydown', manejarAtajoDeshacer);
  }, [deshacerEliminacion, trabajadorEliminado]);

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

  async function manejarEnterArea(evento, area) {
    if (evento.key !== 'Enter' || evento.nativeEvent?.isComposing) return;
    evento.preventDefault();
    if (evento.repeat || eliminandoAreas.current.has(area.id)) return;
    const campo = evento.currentTarget;
    if (campo.value.trim()) {
      campo.blur();
      return;
    }
    eliminandoAreas.current.add(area.id);
    campo.blur();
    try {
      await pedirJson(`${API}/areas/${area.id}`, { method: 'DELETE' });
      setAreas(actual => actual.filter(item => Number(item.id) !== Number(area.id)));
      await cargarDatos();
      setMensaje(`El area ${area.nombre} fue desactivada. Sus registros se conservan.`);
    } catch (error) {
      campo.value = area.nombre;
      setMensaje(`No se pudo eliminar el area: ${error.message}`);
    } finally {
      eliminandoAreas.current.delete(area.id);
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

  async function moverTrabajador(trabajador, areaId) {
    if (semanaCargada !== semana || Number(areaId) === obtenerAreaSemana(trabajador)) return;
    try {
      await pedirJson(`${API}/trabajadores/${trabajador.id}/area`, opcionesJson('PUT', {
        area_id: Number(areaId), semana_inicio: semana
      }));
      const datos = await pedirJson(`${API}/horarios?semana_inicio=${semana}`);
      if (semanaActual.current !== semana) return;
      setHorarios(datos);
      setTrabajadores(actual => actual.map(item => Number(item.id) === Number(trabajador.id)
        ? { ...item, area_id: Number(areaId) } : item));
      setMensaje('Mesero trasladado. Su historial y el acumulado de otras semanas se conservan.');
    } catch (error) {
      setMensaje(`No se pudo trasladar al mesero: ${error.message}`);
    }
  }

  async function eliminarTrabajador(trabajador) {
    try {
      await pedirJson(`${API}/trabajadores/${trabajador.id}`, { method: 'DELETE' });
      setTrabajadores(actual =>
        actual.filter(item => Number(item.id) !== Number(trabajador.id))
      );
      deshaciendoEliminacion.current = false;
      setTrabajadorEliminado(trabajador);
      setMensaje(`${trabajador.nombre} fue eliminado. Puedes deshacerlo con Ctrl+Z.`);
      return true;
    } catch (error) {
      setMensaje(`No se pudo eliminar al mesero: ${error.message}`);
      return false;
    }
  }

  async function manejarEnterNombre(evento, trabajador) {
    if (evento.key !== 'Enter') return;

    evento.preventDefault();
    const campo = evento.currentTarget;
    if (campo.value.trim()) {
      campo.blur();
      return;
    }

    campo.blur();
    const eliminado = await eliminarTrabajador(trabajador);
    if (!eliminado) campo.value = trabajador.nombre;
  }

  function obtenerHorario(trabajadorId, dia) {
    const encontrado = horarios.find(item =>
      Number(item.trabajador_id) === Number(trabajadorId) &&
      item.dia_semana === dia
    );

    return encontrado?.horario || 'LIBRE';
  }

  function obtenerAuxiliarSemana() {
    const barman = trabajadores.find(item => prioridadCargo(item.cargo) === 0);
    if (!barman) return null;
    const areaBar = obtenerAreaSemana(barman);
    const candidatos = trabajadores.filter(item =>
      prioridadCargo(item.cargo) !== 0 && obtenerAreaSemana(item) === areaBar
    );
    return candidatos.find(item => prioridadCargo(item.cargo) === 1)
      || candidatos.slice().sort((a, b) => Number(a.id) - Number(b.id))[0]
      || null;
  }

  function obtenerCargoSemana(trabajador) {
    if (prioridadCargo(trabajador.cargo) === 0) return trabajador.cargo;
    const auxiliar = obtenerAuxiliarSemana();
    if (Number(auxiliar?.id) === Number(trabajador.id)) return 'AUX-BARMAN';
    return prioridadCargo(trabajador.cargo) === 1 ? 'MESERO' : trabajador.cargo || 'MESERO';
  }

  function ordenarPersonalSemana(a, b) {
    return ordenarPorCargo({ cargo: obtenerCargoSemana(a) }, { cargo: obtenerCargoSemana(b) });
  }

  function obtenerAreaSemana(trabajador) {
    const registros = horarios.filter(item =>
      Number(item.trabajador_id) === Number(trabajador.id) && item.area_id != null
    );
    const primero = registros.reduce((anterior, item) =>
      !anterior || Number(item.id) < Number(anterior.id) ? item : anterior, null
    );
    return Number(primero?.area_id ?? trabajador.area_id);
  }

  const semanaActual = useRef(semana);
  useEffect(() => { semanaActual.current = semana; }, [semana]);

  async function guardarHorario(trabajadorId, dia, valor) {
    if (semanaCargada !== semana) return;

    const horario = valor.trim() || 'LIBRE';
    if (horario === obtenerHorario(trabajadorId, dia)) return;

    try {
      const guardado = await pedirJson(`${API}/horarios`, opcionesJson('POST', {
        trabajador_id: trabajadorId,
        semana_inicio: semana,
        dia_semana: dia,
        horario
      }));

      if (semanaActual.current !== semana) return;
      setHorarios(actual => {
        const otros = actual.filter(item => !(
          Number(item.trabajador_id) === Number(trabajadorId) &&
          item.dia_semana === dia
        ));

        return [...otros, { ...guardado, trabajador_id: trabajadorId, dia_semana: dia, horario }];
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
        ...DIAS.map(dia => ({
          width: anchoColumna(
            trabajadores.map(trabajador => obtenerHorario(trabajador.id, dia.clave)),
            18
          )
        })),
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
          trabajador => obtenerAreaSemana(trabajador) === Number(area.id)
        ).sort(ordenarPersonalSemana);

        for (const trabajador of personal) {
          const fila = hoja.addRow([
            trabajador.nombre,
            obtenerCargoSemana(trabajador),
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
  const areasEstadisticas = [...new Map(estadisticas.map(item => [
    String(item.area_id), { id: String(item.area_id), nombre: item.area }
  ])).values()];
  const meserosPorId = new Map();
  const totalesPorArea = new Map();
  let totalDiasTrabajados = 0;
  for (const item of estadisticas) {
    const id = String(item.trabajador_id);
    const areaId = String(item.area_id);
    const dias = Number(item.dias_trabajados) || 0;
    if (!meserosPorId.has(id)) {
      meserosPorId.set(id, { id, nombre: item.trabajador, diasPorArea: new Map(), total: 0 });
    }
    const mesero = meserosPorId.get(id);
    mesero.diasPorArea.set(areaId, dias);
    mesero.total += dias;
    totalesPorArea.set(areaId, (totalesPorArea.get(areaId) || 0) + dias);
    totalDiasTrabajados += dias;
  }
  const formatoSemanas = dias => { const semanas = Math.floor(dias / 7); const restantes = dias % 7; return `${semanas} sem.${restantes ? ` + ${restantes} d` : ''}`; };
  const meserosEstadisticas = [...meserosPorId.values()]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return (
    <div className="aplicacion">
      <header className="encabezado">
        <div className="identidad-encabezado">
          <div className="logo-institucional">
            <img src="/colsubsidio.svg" alt="Colsubsidio" width="181" height="36" />
          </div>
          <div>
          <h1>CONTROL DE HORARIOS</h1>
          <p>Programación semanal del personal</p>
        </div>
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
        <section className="panel panel-planilla">
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
              <button type="button" aria-label="Semana anterior" onClick={() => cambiarSemana(-7)}>←</button>
              <button type="button" aria-label="Semana siguiente" onClick={() => cambiarSemana(7)}>→</button>
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

          <div className="resumen-planilla">
            <div className="periodo-planilla">
              <span className="icono-periodo" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 11h18M7 15h3M14 15h3" /></svg>
              </span>
              <div>
                <span>PROGRAMACIÓN SEMANAL</span>
                <strong>{fechaDeDia(semana, -1).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} — {fechaDeDia(semana, 5).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
              </div>
            </div>
            <div className="cifras-planilla">
              <span><strong>{trabajadores.length}</strong> personas</span>
              <span><strong>{areas.length}</strong> áreas</span>
              <span className="estado-planilla" role="status">{cargando ? 'Cargando turnos…' : 'Semana cargada'}</span>
            </div>
          </div>
          <div className="leyenda-planilla" aria-label="Colores de los estados">
            <span className="titulo-leyenda">ESTADOS</span>
            <span><i className="punto-descanso" />Descanso</span>
            <span><i className="punto-compensatorio" />Compensatorio</span>
            <span><i className="punto-incapacidad" />Incapacidad</span>
            <span><i className="punto-licencia" />Licencia</span>
            <span><i className="punto-libre" />Libre</span>
          </div>
          <div className="tabla-contenedor tabla-planilla-contenedor">
            <table className="tabla-horarios">
              <thead>
                <tr>
                  <th className="columna-trabajador">MESEROS</th>
                  <th className="columna-cargo">CARGO</th>
                  {DIAS.map(dia => (
                    <th key={dia.clave} className={`encabezado-dia ${fechaLocal(fechaDeDia(semana, dia.desplazamiento)) === fechaLocal(new Date()) ? 'dia-hoy' : ''}`}>
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
                    obtenerAreaSemana(trabajador) === Number(area.id)
                  ).sort(ordenarPersonalSemana);

                  return (
                    <React.Fragment key={area.id}>
                      <tr className="fila-area">
                        <td colSpan={10}>
                          <div className="area-info">
                          <span className="marca-area" aria-hidden="true" />
                          <input
                            className="nombre-editable"
                            aria-label={`Editar área ${area.nombre}`}
                            key={`${area.id}-${area.nombre}`}
                            defaultValue={area.nombre}
                            onKeyDown={evento => manejarEnterArea(evento, area)}
                            onBlur={evento => editarArea(area, evento.target.value)}
                          />
                          <span className="conteo-area">{personal.length} {personal.length === 1 ? 'persona' : 'personas'}</span>
                          </div>
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
                              onKeyDown={evento => manejarEnterNombre(evento, trabajador)}
                              onBlur={evento => editarTrabajador(
                                trabajador, 'nombre', evento.target.value
                              )}
                            />
                            <select
                              className="selector-area-mesero"
                              aria-label={`Mover de area a ${trabajador.nombre}`}
                              title="Traslada al mesero en esta semana conservando su historial"
                              value={obtenerAreaSemana(trabajador)}
                              disabled={cargando}
                              onChange={evento => moverTrabajador(trabajador, evento.target.value)}
                            >
                              {areas.map(destino => <option key={destino.id} value={destino.id}>{destino.nombre}</option>)}
                            </select>
                          </td>

                          <td className="celda-cargo">
                            <input
                              className="cargo-editable"
                              aria-label={`Cargo de ${trabajador.nombre}`}
                              key={`${trabajador.id}-${obtenerCargoSemana(trabajador)}`}
                              defaultValue={obtenerCargoSemana(trabajador)}
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
                                <textarea
                                  className={`celda-horario ${claseHorario(valor)}`}
                                  aria-label={`Horario de ${trabajador.nombre} el ${dia.clave}`}
                                  key={`${trabajador.id}-${dia.clave}-${semana}-${valor}`}
                                  defaultValue={valor === 'LIBRE' ? '' : valor}
                                  placeholder={cargando ? '' : 'LIBRE'}
                                  rows={1}
                                  ref={ajustarAlturaCeldaHorario}
                                  disabled={cargando}
                                  onKeyDown={enterGuarda}
                                  onInput={evento => ajustarAlturaCeldaHorario(evento.currentTarget)}
                                  onBlur={evento => guardarHorario(
                                    trabajador.id, dia.clave, evento.target.value
                                  )}
                                />
                              </td>
                            );
                          })}

                          <td className="total-horas">
                            <span className="insignia-horas">{cargando ? '...' : totalHoras(trabajador.id)}<small> h</small></span>
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
            Cada turno se registra en el área asignada al guardarlo.
          </p>

          {mensaje && (
            <div className="mensaje" role="alert">
              <span>{mensaje}</span>
              {trabajadorEliminado && (
                <button type="button" onClick={deshacerEliminacion}>
                  Deshacer
                </button>
              )}
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
                <h2>Semanas trabajadas por área</h2>
                <p>
                  Acumulado de todas las semanas: consulta las semanas equivalentes que cada mesero ha trabajado
                  en cada área.
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
              Cada 7 días efectivamente trabajados equivalen a 1 semana, incluso si están repartidos entre distintas semanas del calendario. El acumulado no se reinicia. Se muestran todos los meseros en cada
              área y cada día trabajado se suma al área que tenía asignada al guardar ese turno.
              No se cuentan días libres, descansos, incapacidades, licencias ni compensatorios.
              Los horarios anteriores al registro histórico se asignaron al área actual y no se
              pueden reconstruir.
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
                    <span>Semanas equivalentes</span>
                    <strong>{formatoSemanas(totalDiasTrabajados)}</strong>
                    <small>En todas las áreas</small>
                  </article>
                  <article className="tarjeta-resumen">
                    <span>Áreas con personal</span>
                    <strong>{areasEstadisticas.length}</strong>
                    <small>Distribución del personal</small>
                  </article>
                  <article className="tarjeta-resumen">
                    <span>Meseros</span>
                    <strong>{meserosEstadisticas.length}</strong>
                    <small>Un equipo, todas las semanas</small>
                  </article>
                </div>

                <div className="tabla-contenedor estadisticas-matriz">
                  <table className="tabla-estadisticas">
                    <caption>Semanas equivalentes por área (7 días trabajados = 1 semana)</caption>
                    <thead>
                      <tr>
                        <th scope="col">Mesero</th>
                        {areasEstadisticas.map(area => <th scope="col" key={area.id}>{area.nombre}</th>)}
                        <th scope="col">Total semanas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meserosEstadisticas.map(mesero => (
                        <tr key={mesero.id}>
                          <th scope="row">
                            <div className="identidad-mesero">
                              <span className="avatar-mesero" aria-hidden="true">{mesero.nombre.trim().split(/\s+/).slice(0, 2).map(parte => parte[0]).join('')}</span>
                              <span>{mesero.nombre}</span>
                            </div>
                          </th>
                          {areasEstadisticas.map(area => (
                            <td key={area.id}>
                              <div className="dato-area">
                                <span className={(mesero.diasPorArea.get(area.id) || 0) ? 'dias-con-turno' : 'dias-sin-turno'}>
                                  {formatoSemanas(mesero.diasPorArea.get(area.id) || 0)}
                                </span>
                                <span className="barra-distribucion" aria-hidden="true">
                                  <span style={{ width: ((mesero.diasPorArea.get(area.id) || 0) / Math.max(1, mesero.total) * 100) + '%' }} />
                                </span>
                              </div>
                            </td>
                          ))}
                          <td className="total-estadisticas"><span className="insignia-total">{formatoSemanas(mesero.total)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">Total por área</th>
                        {areasEstadisticas.map(area => (
                          <td key={area.id}>{formatoSemanas(totalesPorArea.get(area.id) || 0)}</td>
                        ))}
                        <td>{formatoSemanas(totalDiasTrabajados)}</td>
                      </tr>
                    </tfoot>
                  </table>
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

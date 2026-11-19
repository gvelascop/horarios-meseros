export const DIAS = [
  { clave: 'Domingo', titulo: 'DOM', desplazamiento: -1 },
  { clave: 'Lunes', titulo: 'LUN', desplazamiento: 0 },
  { clave: 'Martes', titulo: 'MAR', desplazamiento: 1 },
  { clave: 'Miercoles', titulo: 'MIÉ', desplazamiento: 2 },
  { clave: 'Jueves', titulo: 'JUE', desplazamiento: 3 },
  { clave: 'Viernes', titulo: 'VIE', desplazamiento: 4 },
  { clave: 'Sabado', titulo: 'SÁB', desplazamiento: 5 }
];

export function fechaLocal(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

export function parsearFecha(texto) {
  const [anio, mes, dia] = texto.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

export function obtenerLunes(fecha = new Date()) {
  const copia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  copia.setDate(copia.getDate() - ((copia.getDay() + 6) % 7));
  return fechaLocal(copia);
}

export function fechaDeDia(lunes, desplazamiento) {
  const fecha = parsearFecha(lunes);
  fecha.setDate(fecha.getDate() + desplazamiento);
  return fecha;
}

export function calcularHoras(horario) {
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

export function anchoColumna(valores, minimo) {
  return valores.reduce(
    (ancho, valor) => Math.min(
      26,
      Math.max(ancho, String(valor || '').length + 2)
    ),
    minimo
  );
}

export function ajustarAlturaCeldaHorario(celda) {
  if (!celda) return;
  celda.style.height = 'auto';
  celda.style.height = `${celda.scrollHeight}px`;
}


export function prioridadCargo(cargo) {
  const normalizado = String(cargo || '').trim().toUpperCase().replace(/[\s_-]+/g, '');
  if (normalizado === 'BARMAN') return 0;
  if (normalizado === 'AUXBARMAN' || normalizado === 'AUXILIARBARMAN' || normalizado === 'AUXILIARDEBARMAN') return 1;
  return 2;
}

export function ordenarPorCargo(a, b) {
  return prioridadCargo(a.cargo) - prioridadCargo(b.cargo);
}

export function claseHorario(valor) {
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


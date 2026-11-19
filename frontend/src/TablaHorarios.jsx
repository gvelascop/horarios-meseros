import React from 'react';
import { DIAS, fechaLocal, fechaDeDia, claseHorario, ajustarAlturaCeldaHorario } from './horariosUtils';

export default function TablaHorarios({
  areas,
  trabajadores,
  semana,
  cargando,
  areasContraidas,
  alternarArea,
  obtenerAreaSemana,
  ordenarPersonalSemana,
  manejarEnterArea,
  editarArea,
  manejarEnterNombre,
  editarTrabajador,
  moverTrabajador,
  obtenerCargoSemana,
  enterGuarda,
  obtenerHorario,
  seleccionTodosHorarios,
  guardarHorario,
  totalHoras,
  nuevosTrabajadores,
  setNuevosTrabajadores,
  agregarTrabajador
}) {
  return (
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
                      <button type="button" onClick={() => alternarArea(area.id)}
                        aria-expanded={!areasContraidas.includes(String(area.id))}
                        aria-label={`${areasContraidas.includes(String(area.id)) ? 'Expandir' : 'Contraer'} área ${area.nombre}`}
                        title={areasContraidas.includes(String(area.id)) ? 'Mostrar meseros' : 'Ocultar meseros'}
                        style={{ border: '1px solid currentColor', borderRadius: 5, background: 'transparent', color: 'inherit', cursor: 'pointer', padding: '3px 9px', fontWeight: 700 }}>
                        {areasContraidas.includes(String(area.id)) ? '▸' : '▾'}
                      </button>
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

                  {!areasContraidas.includes(String(area.id)) && personal.map(trabajador => (
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
                          <td className={`celda ${seleccionTodosHorarios ? 'celda-seleccionada' : ''}`} key={dia.clave}>
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

                  {!areasContraidas.includes(String(area.id)) && <tr className="fila-agregar">
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
                  </tr>}
                </React.Fragment>
              );
            })}

          </tbody>
        </table>
      </div>
  );
}

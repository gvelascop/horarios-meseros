export default function VistaPreviaImportacion({ errorImportacion, filasImportacion, semana, importando, confirmarImportacion, cancelarImportacion }) {
  return (
    <>
      {errorImportacion && <p role="alert" className="mensaje">{errorImportacion}</p>}
      {filasImportacion.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <h3>Vista previa de importación</h3>
          <p>Semana seleccionada: {semana}. Se importarán {filasImportacion.length} trabajadores y sus turnos. Los horarios existentes de esta semana para esos trabajadores se actualizarán; las otras semanas se conservarán.</p>
          <div className="tabla-contenedor" style={{ maxHeight: 260, overflow: 'auto' }}>
            <table className="tabla-estadisticas"><thead><tr><th>Área</th><th>Mesero</th><th>Cargo</th><th>Turnos</th></tr></thead>
              <tbody>{filasImportacion.map((fila, i) => <tr key={i}><td>{fila.area}</td><td>{fila.nombre}</td><td>{fila.cargo}</td><td>{Object.entries(fila.turnos).map(([dia, turno]) => `${dia}: ${turno}`).join(' · ')}</td></tr>)}</tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button type="button" disabled={importando} onClick={confirmarImportacion}>{importando ? 'Importando…' : 'Confirmar y guardar'}</button>
            <button type="button" disabled={importando} onClick={cancelarImportacion}>Cancelar</button>
          </div>
        </div>
      )}
    </>
  );
}

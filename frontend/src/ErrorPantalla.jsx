import { Component } from 'react';

export default class ErrorPantalla extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error al mostrar la aplicación:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main style={{ maxWidth: 620, margin: '10vh auto', padding: 24, fontFamily: 'Arial, sans-serif' }}>
        <h1>No se pudo mostrar la aplicación</h1>
        <p>Se produjo un error al cargar la pantalla. Tus horarios no se han borrado.</p>
        <p style={{ overflowWrap: 'anywhere', color: '#555' }}>
          Detalle: {this.state.error.message}
        </p>
        <button type="button" onClick={() => window.location.reload()}>Volver a intentar</button>
      </main>
    );
  }
}

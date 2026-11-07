import { useCallback, useEffect, useState } from 'react';
import { apiJson, enviarJson, actualizarCsrf } from './api';
import './Auth.css';

function Cuentas({ usuario, actualizarSesion, cerrar }) {
  const [usuarios, setUsuarios] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const cargarUsuarios = useCallback(async () => {
    if (usuario.rol === 'admin') setUsuarios(await apiJson('/api/auth/usuarios'));
  }, [usuario.rol]);
  useEffect(() => {
    let vigente = true;
    if (usuario.rol === 'admin') apiJson('/api/auth/usuarios')
      .then(datos => { if (vigente) setUsuarios(datos); })
      .catch(error => { if (vigente) setMensaje(error.message); });
    return () => { vigente = false; };
  }, [usuario.rol]);
  async function cambiarClave(evento) {
    evento.preventDefault();
    const form = evento.currentTarget;
    const datos = new FormData(form);
    if (datos.get('nueva') !== datos.get('confirmacion')) { setMensaje('Las claves nuevas no coinciden.'); return; }
    setOcupado(true);
    try {
      actualizarSesion(await apiJson('/api/auth/clave', enviarJson('POST', { actual: datos.get('actual'), nueva: datos.get('nueva') })));
      form.reset();
      setMensaje('Clave actualizada. Las otras sesiones se cerraron.');
    } catch (error) { setMensaje(error.message); }
    finally { setOcupado(false); }
  }
  async function crearUsuario(evento) {
    evento.preventDefault();
    const form = evento.currentTarget;
    setOcupado(true);
    try {
      const datos = Object.fromEntries(new FormData(form));
      await apiJson('/api/auth/usuarios', enviarJson('POST', datos));
      form.reset();
      await cargarUsuarios();
      setMensaje('Usuario creado. Ya puede iniciar sesión.');
    } catch (error) { setMensaje(error.message); }
    finally { setOcupado(false); }
  }
  async function cambiarEstado(cuenta) {
    setOcupado(true);
    try {
      await apiJson(`/api/auth/usuarios/${cuenta.id}/estado`, enviarJson('PUT', { activo: !cuenta.activo }));
      await cargarUsuarios();
      setMensaje('Acceso actualizado.');
    } catch (error) { setMensaje(error.message); }
    finally { setOcupado(false); }
  }
  return (
    <section className="panel-cuentas" aria-label="Mi cuenta y usuarios">
      <div className="titulo-cuentas"><div><span className="auth-etiqueta">ACCESO AL EQUIPO</span><h2>Mi cuenta{usuario.rol === 'admin' ? ' y usuarios' : ''}</h2></div><button type="button" onClick={cerrar}>Volver a horarios</button></div>
      {mensaje && <p className="auth-mensaje" role="status">{mensaje}</p>}
      <div className="columnas-cuentas">
        <form className="auth-form" onSubmit={cambiarClave}>
          <h3>Cambiar mi contraseña</h3>
          <label>Contraseña actual<input name="actual" type="password" autoComplete="current-password" required maxLength={256} /></label>
          <label>Nueva contraseña<input name="nueva" type="password" autoComplete="new-password" required minLength={12} maxLength={256} /></label>
          <label>Repetir nueva contraseña<input name="confirmacion" type="password" autoComplete="new-password" required minLength={12} maxLength={256} /></label>
          <p className="auth-ayuda">Usa al menos 12 caracteres. Puedes usar una frase larga.</p>
          <button className="auth-principal" disabled={ocupado}>Guardar contraseña</button>
        </form>
        {usuario.rol === 'admin' && <form className="auth-form" onSubmit={crearUsuario}>
          <h3>Crear acceso para otra persona</h3>
          <label>Nombre<input name="nombre" autoComplete="off" required maxLength={100} /></label>
          <label>Usuario<input name="usuario" autoComplete="off" required minLength={3} maxLength={80} pattern="[a-zA-Z0-9._@\-]+" /></label>
          <label>Contraseña inicial<input name="clave" type="password" autoComplete="new-password" required minLength={12} maxLength={256} /></label>
          <label>Permisos<select name="rol" defaultValue="editor"><option value="editor">Editor de horarios</option><option value="admin">Administrador de usuarios y horarios</option></select></label>
          <button className="auth-principal" disabled={ocupado}>Crear usuario</button>
        </form>}
      </div>
      {usuario.rol === 'admin' && <div className="lista-cuentas"><h3>Usuarios con acceso</h3>{usuarios.map(cuenta => <div className="fila-cuenta" key={cuenta.id}><span><strong>{cuenta.nombre}</strong><small>{cuenta.usuario} · {cuenta.rol === 'admin' ? 'Administrador' : 'Editor'} · {cuenta.activo ? 'Activo' : 'Inactivo'}</small></span>{cuenta.id !== usuario.id && <button type="button" disabled={ocupado} onClick={() => cambiarEstado(cuenta)}>{cuenta.activo ? 'Desactivar acceso' : 'Reactivar acceso'}</button>}</div>)}</div>}
    </section>
  );
}

export default function Auth({ children }) {
  const [sesion, setSesion] = useState(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [cuentas, setCuentas] = useState(false);
  const [reintento, setReintento] = useState(0);
  useEffect(() => {
    let vigente = true;
    apiJson('/api/auth/sesion').then(datos => { if (vigente) { setSesion(datos); setError(''); } }).catch(e => { if (vigente) setError(e.message); });
    function expirada() { setSesion(null); setCuentas(false); setReintento(n => n + 1); }
    window.addEventListener('sesion-expirada', expirada);
    return () => { vigente = false; window.removeEventListener('sesion-expirada', expirada); };
  }, [reintento]);
  async function entrar(evento) {
    evento.preventDefault();
    setOcupado(true);
    setError('');
    const datos = Object.fromEntries(new FormData(evento.currentTarget));
    if (!sesion.configurado && datos.clave !== datos.confirmacion) { setError('Las contraseñas no coinciden.'); setOcupado(false); return; }
    try {
      setSesion(await apiJson(sesion.configurado ? '/api/auth/login' : '/api/auth/configurar', enviarJson('POST', datos)));
    } catch (e) { setError(e.message); }
    finally { setOcupado(false); }
  }
  async function salir() {
    setOcupado(true);
    try {
      await apiJson('/api/auth/logout', { method: 'POST' });
      actualizarCsrf('');
      setSesion(null);
      setCuentas(false);
      setReintento(n => n + 1);
    } catch (e) { setError(e.message); }
    finally { setOcupado(false); }
  }
  if (!sesion) return <main className="acceso-pagina"><div className="acceso-tarjeta"><img className="auth-logo" src="/colsubsidio.svg" alt="Colsubsidio" width="181" height="36" /><h1>{error ? 'No pudimos conectar' : 'Comprobando tu acceso…'}</h1>{error && <><p className="auth-mensaje" role="alert">{error}</p><button className="auth-principal" onClick={() => setReintento(n => n + 1)}>Reintentar</button></>}</div></main>;
  if (!sesion.usuario) return (
    <main className="acceso-pagina">
      <section className="acceso-presentacion"><span className="auth-etiqueta">PLANILLA DEL EQUIPO</span><h1>Los turnos,<br />en un solo lugar.</h1><p>Organiza las semanas y consulta el recorrido de tu equipo con acceso protegido.</p><span className="acceso-sello">Programación · Áreas · Estadísticas</span></section>
      <section className="acceso-tarjeta">
        <img className="auth-logo" src="/colsubsidio.svg" alt="Colsubsidio" width="181" height="36" />
        <h2>{sesion.configurado ? 'Bienvenido de nuevo' : 'Crea la primera cuenta'}</h2>
        <p className="acceso-subtitulo">{sesion.configurado ? 'Ingresa tus datos para continuar a los horarios.' : 'Configura al administrador de la aplicación.'}</p>
        <form className="auth-form" onSubmit={entrar}>
          {!sesion.configurado && <><label>Código de configuración<input name="codigo" type="password" required autoComplete="off" /></label><p className="auth-ayuda">Copia SETUP_TOKEN del archivo backend/.auth-local.json o del entorno del servidor.</p><label>Tu nombre<input name="nombre" autoComplete="name" required maxLength={100} /></label></>}
          <label>Usuario<input name="usuario" autoComplete="username" required minLength={3} maxLength={80} autoCapitalize="none" spellCheck={false} /></label>
          <label>Contraseña<input name="clave" type="password" autoComplete={sesion.configurado ? 'current-password' : 'new-password'} required minLength={sesion.configurado ? undefined : 12} maxLength={256} /></label>
          {!sesion.configurado && <><label>Repite la contraseña<input name="confirmacion" type="password" autoComplete="new-password" required minLength={12} maxLength={256} /></label><p className="auth-ayuda">Elige una contraseña de al menos 12 caracteres.</p></>}
          {error && <p className="auth-mensaje" role="alert">{error}</p>}
          <button className="auth-principal" disabled={ocupado}>{ocupado ? 'Un momento…' : sesion.configurado ? 'Iniciar sesión' : 'Crear administrador'}</button>
        </form>
        <p className="acceso-pie">Acceso exclusivo para personal autorizado.</p>
      </section>
    </main>
  );
  return <><div className="barra-sesion"><span>Hola, <strong>{sesion.usuario.nombre}</strong></span><div><button type="button" onClick={() => setCuentas(valor => !valor)}>{cuentas ? 'Volver a horarios' : sesion.usuario.rol === 'admin' ? 'Mi cuenta y usuarios' : 'Mi cuenta'}</button><button type="button" onClick={salir} disabled={ocupado}>Cerrar sesión</button></div></div>{error && <p role="alert" className="auth-mensaje">{error}</p>}{cuentas ? <Cuentas usuario={sesion.usuario} actualizarSesion={setSesion} cerrar={() => setCuentas(false)} /> : children}</>;
}

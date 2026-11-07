# Acceso y seguridad

## Primera cuenta en este computador

1. Inicia el backend con `npm start` y abre `http://localhost:3000`.
2. Abre `backend/.auth-local.json` y copia el valor `SETUP_TOKEN` (sin las comillas).
3. En la pantalla de acceso, introduce ese codigo, tu nombre, el usuario y una contrasena de al menos 12 caracteres.
4. Una vez creada la primera cuenta, la configuracion inicial queda bloqueada. No hay usuario ni contrasena predeterminados.
5. En **Mi cuenta y usuarios**, el administrador puede crear cuentas y desactivar accesos. Cada persona puede cambiar su contrasena desde **Mi cuenta**.

El archivo `.auth-local.json` contiene secretos y esta excluido de Git. No se debe compartir ni publicar. Conserva una copia segura: su SESSION_SECRET permite validar las sesiones locales despues de reiniciar.

## Permisos y sesiones

- Administrador: modifica horarios y gestiona usuarios.
- Editor: modifica horarios, areas y trabajadores; no administra usuarios.
- Las cuentas de acceso son independientes de la lista de meseros.
- Todas las rutas de datos requieren una sesion valida. Las sesiones duran hasta 8 horas y se guardan en MySQL.
- Cerrar sesion elimina esa sesion; cambiar la contrasena o desactivar una cuenta invalida sus sesiones anteriores.
- Las claves se guardan como hashes scrypt con sal aleatoria. El navegador usa cookies HttpOnly y SameSite=Strict, con proteccion CSRF y limites de intentos de acceso.
- No hay recuperacion de contrasena por correo en esta version. Conserva las credenciales del administrador en un gestor seguro.

## Antes de publicar en internet

Configura estas variables secretas en el alojamiento (no en Git):

- `NODE_ENV=production`
- `SESSION_SECRET`: valor aleatorio de al menos 32 caracteres, persistente entre despliegues.
- `SETUP_TOKEN`: codigo aleatorio para la primera cuenta.
- `APP_ORIGIN`: origen HTTPS exacto, sin barra final (por ejemplo `https://horarios.ejemplo.com`).
- `TRUST_PROXY=1`: solo si hay exactamente un proxy de confianza delante del servidor. Ajustar la configuracion de Express si la plataforma usa otra topologia.
- Las variables MySQL de `backend/.env.example`.

En produccion la cookie es Secure y requiere HTTPS. La aplicacion se detiene si falta SESSION_SECRET. El frontend y la API deben servirse bajo el mismo origen. En desarrollo, Vite envia `/api` al backend por su proxy.

La inicializacion crea solo tres tablas nuevas (`seguridad_usuarios`, `seguridad_config`, `seguridad_sesiones`); no cambia las tablas de horarios ni trabajadores. La cuenta MySQL necesita permiso para crearlas, o TI puede preparar esas tablas antes del arranque.

Los nombres y horarios laborales deben publicarse solo en un alojamiento autorizado por la empresa. El acceso por aplicacion no protege copias anteriores que ya se hayan subido a GitHub. Las credenciales de base de datos que estuvieron en el historial de Git deben rotarse antes de publicar; excluir `.env` ahora no las elimina del historial.

## Verificacion

- Frontend: `npm run lint` y `npm run build` desde `frontend`.
- Backend: `npm test` desde `backend` con una base MySQL de prueba configurada. Las pruebas crean tres tablas con un prefijo aleatorio `prueba_auth_...`, y solo esas tablas se eliminan al terminar.
- Dependencias de produccion: `npm audit --omit=dev` desde `backend`.

No ejecutes los scripts de importacion para iniciar la aplicacion: modifican horarios y solo deben usarse para las cargas de datos correspondientes.

# Publicar en Render y TiDB Cloud

La aplicacion se publica como UN servicio web: Node sirve la API y el frontend compilado. No necesitas Vercel ni Netlify adicionales. La base de datos vive en TiDB Cloud. Tu computador no debe permanecer encendido.

## 1. Crear cuentas

- Render: https://dashboard.render.com/register . Puedes usar tu cuenta de GitHub para conectar el repositorio.
- TiDB Cloud: https://tidbcloud.com/ . Selecciona Starter y **MySQL Compatible**, no PostgreSQL.
- Usa las opciones gratuitas. No elijas Essential, Dedicated ni servicios de pago.

## 2. Crear la base en TiDB Cloud

1. Crea una instancia Starter gratuita (Free Instance, o equivalente).
2. En su editor SQL crea una base nueva llamada `horarios_meseros`:

```sql
CREATE DATABASE IF NOT EXISTS horarios_meseros;
USE horarios_meseros;
```

3. Para una prueba vacia, ejecuta el contenido de `database/000_esquema_inicial.sql`. Si vas a migrar los datos actuales, usa el archivo generado en el paso siguiente: ya incluye la estructura.
4. Pulsa **Connect** y conserva en un gestor de contrasenas el Host, Port, User y Password. El usuario incluye un prefijo que debes copiar completo.
5. La conexion usa TLS con verificacion de certificado (`DB_SSL=true`). No desactives esa verificacion.
6. Si la instancia muestra reglas de red, permite las IP de salida indicadas por el servicio de Render. Evita abrirla a todas las IP si puedes restringirlas.

## 3. Llevar los horarios actuales (solo si se autoriza su almacenamiento externo)

En tu computador, desde `backend`:

```powershell
npm run exportar-datos
```

El comando lee la base local y crea un `.sql` en `database/exportaciones/`. No modifica la base local, no exporta cuentas de acceso ni sesiones y el archivo esta excluido de Git.

Ejecuta ese archivo en la base NUEVA y VACIA de TiDB desde el editor/importador SQL. No lo ejecutes sobre una base con datos: intencionalmente no sobrescribe registros existentes. No ejecutes los scripts antiguos de `backend/importaciones` para migrar: alteran semanas concretas.

La primera cuenta administradora de internet se crea de nuevo en el paso 5. Tu cuenta local sigue funcionando por separado.

## 4. Crear el servicio de Render

Los cambios de autenticacion y `render.yaml` deben estar antes en GitHub. La rama preparada es `mejoras-planilla-historial-2026-11-06`.

Ruta recomendada: **New > Blueprint**, conecta `gvelascop/horarios-meseros`, selecciona esa rama y el archivo `render.yaml`. Revisa que el servicio sea **Free** antes de crearlo. El archivo pide los datos de TiDB y genera los secretos automaticamente.

Si lo creas manualmente mediante **New > Web Service**:

- Repositorio: `gvelascop/horarios-meseros`.
- Rama: `mejoras-planilla-historial-2026-11-06`.
- Runtime: Node.
- Root Directory: dejar VACIO.
- Build Command:

```sh
npm ci --prefix frontend --include=dev && npm run build --prefix frontend && npm ci --prefix backend --omit=dev
```

- Start Command: `npm start --prefix backend`.
- Health Check Path: `/healthz`.
- Plan: Free.
- Auto Deploy: Off (para revisar cada publicacion).

Variables de entorno:

| Variable | Valor |
| --- | --- |
| NODE_VERSION | 22 |
| NODE_ENV | production |
| TRUST_PROXY | 1 |
| DB_SSL | true |
| DB_HOST | Host de Connect de TiDB |
| DB_PORT | Puerto de Connect (normalmente 4000) |
| DB_USER | Usuario completo, incluido su prefijo |
| DB_PASSWORD | Contrasena de TiDB |
| DB_NAME | horarios_meseros |
| SESSION_SECRET | Secreto aleatorio, minimo 32 caracteres |
| SETUP_TOKEN | Otro secreto aleatorio para la configuracion inicial |

En un Blueprint, Render genera SESSION_SECRET y SETUP_TOKEN. Para configuracion manual puedes generar cada secreto desde tu computador con `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. Copia el resultado directamente al panel de Render; no lo subas a Git ni lo envies por chat.

No configures PORT: Render lo proporciona. El origen HTTPS se obtiene de RENDER_EXTERNAL_URL. Si despues agregas un dominio propio, configura APP_ORIGIN con su origen exacto, sin barra final.

## 5. Crear la cuenta y verificar

1. Espera a que Render indique **Live**.
2. Abre el enlace HTTPS `https://...onrender.com` que muestre el panel.
3. En Environment, consulta el SETUP_TOKEN generado por Render e introducelo en **Codigo de configuracion** de la aplicacion. El codigo local no es el del servidor.
4. Crea tu administrador con una contrasena de al menos 12 caracteres.
5. Desde **Mi cuenta y usuarios**, crea accesos para los empleados.
6. Verifica que puedas entrar, cerrar sesion y consultar varias semanas. Abre una ventana privada y comprueba que no muestra horarios sin iniciar sesion.

## Limites y separacion de datos

- Render Free suspende el servicio tras inactividad; la primera visita puede tardar. La base de datos y las sesiones permanecen en TiDB.
- TiDB tiene una cuota gratuita. Conserva la configuracion sin cargos o un limite de gasto acorde a lo autorizado.
- Los cambios en internet no se sincronizan con la base local de tu computador.
- La instancia de TiDB aun debe probarse con la aplicacion: la configuracion local y las pruebas de MySQL no equivalen a una prueba contra ese servicio.
- Conserva respaldos y rota las credenciales que estuvieron antes en el historial de Git. El login no protege copias de datos ya publicadas en repositorios.

Referencias oficiales:

- https://render.com/docs/deploy-node-express-app
- https://render.com/docs/blueprint-spec
- https://render.com/docs/free
- https://docs.pingcap.com/tidbcloud/secure-connections-to-serverless-clusters/
- https://www.pingcap.com/pricing/

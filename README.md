# CD Los Sauces · Control de accesos a la piscina

App móvil para controlar la entrada de los socios del **Club Deportivo Los Sauces** (Papatrigo, Ávila) a la piscina.
Cada socio (padres, hijos, abuelos…) tiene un **carnet con su foto y un código QR**. En la entrada, la taquilla lo
escanea con el móvil y la pantalla se pone **verde (adelante)** o **roja (no puede pasar)** con la foto, el nombre y el
motivo.

- Funciona en cualquier Android o iPhone con cámara, desde el navegador. Se puede instalar como app desde
  «Añadir a pantalla de inicio», sin pasar por las tiendas de aplicaciones.
- También funciona en un portátil con **lector de QR USB**.
- Coste: **0 €**. Usa los planes gratuitos de [Supabase](https://supabase.com) (base de datos) y GitHub Pages
  (alojamiento), que dan de sobra para un club de este tamaño.

## Qué hace

| Función | Detalle |
|---|---|
| **Socios familiares e individuales** | Un socio (nº de socio) agrupa a las personas de la familia. El individual solo admite una persona. |
| **Parentesco y categorías** | Titular, cónyuge, hijo/a, abuelo/a, otro. Cada persona puede marcarse como **fundador** y/o **jubilado**. Se muestra la edad y el aviso «Menor de 14». |
| **Escaneo en la entrada** | Con la cámara del móvil o con un lector USB. Modo entrada/salida, pitido y vibración. Si la cámara lee el mismo QR varias veces, solo se registra una entrada. |
| **Control de cuota** | Si el socio no ha pagado la cuota de la temporada, no entra. Se pueden marcar socios **exentos**. |
| **Temporada** | Fechas de apertura y cierre: fuera de ellas no se permiten entradas. |
| **Invitados (pase de día)** | El socio invita a alguien para un día concreto, con límite de pases por temporada y precio opcional. El pase tiene su propio QR. |
| **Carnet impreso** | Hoja A4 con 10 carnets (foto, nombre, nº de socio, fundador/jubilado y QR) para recortar y plastificar, o formato de tarjeta PVC (CR80) para impresora de tarjetas. |
| **Carnet digital** | Enlace que se envía por WhatsApp. El socio enseña el QR desde su móvil y puede guardar los de toda la familia. |
| **Tarjeta perdida** | Con un botón se genera un QR nuevo: la tarjeta y el enlace antiguos dejan de funcionar. |
| **Aforo** | Cuántas personas hay dentro ahora y quiénes son. Opcionalmente, un aforo máximo. |
| **Estadísticas** | Visitas por día y por hora, quién viene (hijos, abuelos, jubilados, fundadores…), rechazos y su motivo, censo y recaudación de cuotas. |
| **Familias** | Cada nº de socio es una familia («Familia Blázquez Martín») o un socio individual, con sus miembros agrupados. |
| **Perfiles** | **Superadmin** (junta: todo, incluidos los pagos), **Admin** (taquilla: solo control de acceso, sin importes) y **Socio** (ve su familia). Las cuentas nuevas no pueden hacer nada hasta que el superadmin las activa. |
| **Pagos y cuotas** (superadmin) | Tarifas por tipo de socio (familiar, individual, jubilado, fundador), cuotas generadas según la tarifa, pagos en varios plazos, resumen de cobrado y pendiente, exportación a Excel y recibos para imprimir o guardar en PDF. |
| **Área del socio** | Carnets de toda la familia en el móvil, estado de la cuota con sus recibos, historial de entradas y petición de pases de invitado (se pagan en taquilla). |

### Qué comprueba al escanear

1. Que el QR sea de un socio o de un pase de invitado.
2. Que haya una temporada activa y que hoy esté dentro de sus fechas.
3. Que el socio y la persona estén de alta y que la tarjeta no esté bloqueada ni marcada como perdida.
4. Que la cuota de la temporada esté pagada (o que el socio esté exento).
5. Que no se haya llegado al aforo máximo, si se ha fijado.
6. En los invitados: que el pase sea para hoy y esté pagado.

La **salida** siempre se permite. Todas las lecturas, también las rechazadas, quedan registradas. Estas comprobaciones
se hacen en el servidor (función `registrar_acceso` de la base de datos), así que no se pueden saltar desde el móvil.

---

## Puesta en marcha (una sola vez, unos 30 minutos)

### 1. Crear la base de datos en Supabase

1. Crea una cuenta gratuita en <https://supabase.com> y un proyecto nuevo. Región: **Europe (Frankfurt o París)**, por
   protección de datos. Guarda la contraseña de la base de datos.
2. En el proyecto, ve a **SQL Editor → New query**, pega el contenido completo de
   [`supabase/migrations/0001_esquema.sql`](supabase/migrations/0001_esquema.sql) y pulsa **Run**. Repite con
   [`0002_perfiles_y_pagos.sql`](supabase/migrations/0002_perfiles_y_pagos.sql) (y con cada migración nueva, en orden).
3. Ve a **Project Settings → API** y apunta la **Project URL** y la clave **publishable / anon**. Esa clave es pública y
   puede ir en la app; la seguridad la dan las reglas de la base de datos. **Nunca** uses la clave `service_role` /
   `secret` en la app.

### 2. Publicar la app en GitHub Pages

1. En este repositorio de GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → pestaña Variables → New repository variable**, y crea:
   - `VITE_SUPABASE_URL` = la Project URL
   - `VITE_SUPABASE_ANON_KEY` = la clave publishable/anon
3. **Actions → «Comprobar y publicar» → Run workflow** (o haz cualquier cambio en `main`). Al terminar, la app queda
   en `https://<tu-usuario>.github.io/<nombre-del-repo>/`.
4. En Supabase, **Authentication → URL Configuration**: pon esa dirección como **Site URL** (y también en *Redirect
   URLs*). Así funcionan bien los emails de confirmación.

### 3. Crear el primer superadmin

1. Abre la app, pulsa **«¿No tienes cuenta? Créala»** y regístrate con tu email. Confirma el email que
   te llega.
2. En Supabase, **SQL Editor**, ejecuta (con tu email):

   ```sql
   update perfiles set rol = 'superadmin' where email = 'tu-email@ejemplo.com';
   ```

3. Vuelve a la app y recarga. A partir de ahora, las demás cuentas se activan desde la propia app
   (**☰ → Usuarios y socios con cuenta**): personal de taquilla como **admin** y socios como **socio**, vinculados a su
   familia. Si el email de la cuenta coincide con el de la familia, la app lo sugiere.

### 4. Preparar la temporada

1. **☰ → Temporadas → + Temporada**: fechas de apertura y cierre, invitados por socio, precio del pase y
   aforo (opcional). Pulsa **Activar**.
2. **Familias → + Familia**: número de socio y tipo (familiar/individual). Después **+ Persona** para cada miembro: foto
   (se puede hacer en el momento con el móvil), parentesco, fecha de nacimiento y fundador/jubilado.
3. **☰ → Pagos y cuotas**: define las **tarifas** y pulsa **Generar cuotas**. Cada pago (completo o en plazos) se
   registra en la ficha de la familia o desde Pagos, y genera su recibo. La cuota queda pagada cuando los pagos cubren
   el importe.
4. **Carnets**: botón 🖨️ en la ficha (los de la familia) o en el listado de socios (todos). Imprime en A4 al **100 %**,
   recorta por la línea discontinua y plastifica. O envía el **carnet digital** por WhatsApp.

## Uso diario en la taquilla

- Abre la app → **Escanear**. Apunta la cámara al QR del carnet (papel o móvil).
- **Verde**: adelante. **Rojo**: no puede pasar, con el motivo (cuota pendiente, tarjeta bloqueada…). Comprueba que la
  cara coincide con la foto.
- ¿Viene sin carnet? **Socios** → búscalo por nombre o número → **Registrar entrada**.
- **Invitados** → nº del socio que invita + nombre del invitado → **Registrar entrada ahora**.
- La pantalla de **Inicio** muestra cuántas personas hay dentro. El recuento empieza de cero cada día. Si quieres un
  aforo exacto, registra también las salidas (botón **Salida** en el escáner); si no, el número indica cuántos han
  entrado hoy.

### Material recomendado

- Un móvil Android barato para la taquilla, con la app instalada en la pantalla de inicio y el brillo alto.
- Opcional: portátil con un lector de QR USB (unos 25-40 €). Debe ser compatible con QR, no solo códigos de barras
  normales. Si el lector está configurado con teclado inglés y el ordenador en español, los guiones salen cambiados;
  la app ya lo corrige.
- Para los carnets: folios, plastificadora o fundas porta-tarjetas. Si el club tiene impresora de tarjetas PVC, usa el
  formato «CR80».

## Protección de datos (RGPD)

La app trata datos personales, incluidas **fotos de menores**. Recomendaciones para la junta:

- Informa a los socios con una cláusula en la hoja de inscripción. Debe indicar que el responsable es el club y que la
  finalidad es gestionar los socios y el acceso a la piscina. Si se usan las fotos de los menores, pide el
  consentimiento a sus padres.
- El **QR no contiene datos personales**, solo un código aleatorio. El enlace del carnet digital no muestra DNI,
  teléfono ni foto.
- Las fotos se guardan en un almacenamiento **privado**: solo las ven los usuarios aprobados.
- Da acceso de administrador solo a quien lo necesite. La taquilla puede consultar los socios pero no modificarlos.
- Al acabar cada temporada, valora borrar los registros de entradas antiguos (tabla `accesos`) y dar de baja a quien
  ya no sea socio.

## Desarrollo

Requisitos: Node 22. Para las pruebas de la base de datos hace falta PostgreSQL. Para levantar Supabase en local hace
falta Docker.

```bash
npm install
cp .env.example .env.local      # con la URL y la clave de tu proyecto (o las de Supabase local)
npm run dev                     # http://localhost:5173

npm run typecheck               # tipos
npm test                        # pruebas de la app
npm run test:sql                # pruebas de las reglas de acceso sobre un PostgreSQL temporal
npx supabase start              # Supabase completo en local con Docker (aplica las migraciones)
```

### Estructura

```
supabase/migrations/0001_esquema.sql   Tablas, reglas de acceso, seguridad (RLS) y fotos
supabase/tests/                        Pruebas de acceso, perfiles, pagos y migración (77 comprobaciones)
src/pages/                             Pantallas (Escanear, Socios, Invitados, Estadísticas…)
src/components/                        Escáner de QR, tarjeta de resultado, formularios
.github/workflows/ci.yml               Comprobaciones y publicación en GitHub Pages
```

Los cambios en la base de datos se añaden como migraciones nuevas (`0002_….sql`) y se ejecutan en el SQL Editor de
Supabase.

### Ideas para siguientes versiones

- Importar los socios desde el Excel actual del club.
- Recordatorio por email o WhatsApp a quien tenga la cuota pendiente.
- Funcionar sin cobertura (guardar las lecturas y enviarlas al recuperar la conexión).
- Abonos de baño para no socios y venta de entradas sueltas.

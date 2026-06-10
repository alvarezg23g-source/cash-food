# Estructura del proyecto Cash Food

Este documento explica cómo está organizado Cash Food usando lenguaje sencillo. La idea es que una persona pueda abrir el proyecto, entender dónde ocurre cada cosa y saber qué archivo debe modificar sin revisar todo el código.

## Visión general

Cash Food tiene tres partes principales:

1. **Frontend:** todo lo que el cliente y el administrador ven en el navegador.
2. **Backend:** recibe solicitudes, valida datos y decide qué operaciones realizar.
3. **Base de datos:** guarda usuarios, quioscos, productos, pedidos y facturas.

El recorrido normal de una acción es:

```text
Navegador -> API de Express -> PostgreSQL -> API de Express -> Navegador
```

Por ejemplo, cuando un cliente envía un pedido:

1. `public/assets/js/main.js` reúne los productos del carrito.
2. `public/assets/js/core/api.js` envía el pedido al servidor.
3. `src/routes/orders.routes.js` valida los productos y calcula el total.
4. PostgreSQL guarda el pedido en `orders` y sus productos en `order_items`.
5. `src/realtime/order-events.js` avisa inmediatamente al administrador.
6. El navegador del administrador recibe el aviso y muestra la factura.

## Árbol de carpetas

```text
cash-food/
├── public/                         Interfaz que recibe el navegador
│   ├── index.html                  Estructura visual de toda la página
│   └── assets/
│       ├── css/
│       │   └── style.css           Colores, tamaños, animaciones y diseño
│       ├── images/
│       │   └── cash-food-logo.png  Logo de Cash Food
│       └── js/
│           ├── main.js             Sesión, pedidos y coordinación general
│           ├── marketplace.js      Quioscos, productos y carrito del cliente
│           ├── admin.js            Perfil y catálogo del administrador
│           ├── receipts.js         Comprobantes, descargas e impresión
│           └── core/
│               ├── api.js          Comunicación con el servidor
│               ├── format.js       Formatos y funciones reutilizables
│               └── ui.js           Ayudantes visuales compartidos
├── scripts/
│   ├── configure-db.ps1            Configura PostgreSQL en Windows
│   └── init-db.js                  Ejecuta el esquema de la base de datos
├── src/
│   ├── app.js                      Configura Express y conecta las rutas
│   ├── server.js                   Inicia el servidor
│   ├── db/
│   │   ├── pool.js                 Conexión compartida con PostgreSQL
│   │   └── schema.sql              Tablas, relaciones e índices
│   ├── realtime/
│   │   └── order-events.js         Avisos de pedidos en tiempo real
│   └── routes/
│       ├── auth.routes.js          Registro e inicio de sesión
│       ├── catalog.routes.js       Catálogo público
│       ├── admin.routes.js         Perfil y productos del administrador
│       └── orders.routes.js        Pedidos, estados y facturas
├── .env                            Configuración privada de esta computadora
├── .env.example                    Ejemplo de configuración
├── package.json                    Dependencias y comandos npm
├── README.md                       Presentación e instalación rápida
└── GUIA_COMANDOS.md                Comandos frecuentes
```

## Cómo inicia el proyecto

Al ejecutar:

```powershell
npm start
```

ocurre lo siguiente:

1. Node.js abre `src/server.js`.
2. `server.js` carga las variables de `.env`.
3. Comprueba que PostgreSQL responda.
4. Importa `src/app.js`.
5. `app.js` configura Express, las rutas de la API y los archivos públicos.
6. El servidor queda disponible normalmente en `http://localhost:3000`.

Si PostgreSQL no está funcionando o `DATABASE_URL` está mal configurada, el servidor no inicia. Esto evita mostrar una aplicación que luego no puede guardar nada.

## Frontend: lo que ocurre en el navegador

### `public/index.html`

Contiene la estructura visible de la aplicación:

- Página inicial.
- Formularios de registro e inicio de sesión.
- Marketplace del cliente.
- Carrito.
- Historial de pedidos.
- Panel del administrador.
- Formularios del quiosco y productos.
- Ventana de comprobantes.

Este archivo define los elementos. La lógica para hacerlos funcionar está en JavaScript y su apariencia está en CSS.

### `public/assets/css/style.css`

Controla toda la apariencia:

- Colores y tipografías.
- Distribución de tarjetas.
- Diseño del marketplace y panel administrativo.
- Adaptación para celulares.
- Animaciones de inicio de sesión y avisos de pedidos.

Si algo funciona correctamente pero se ve mal, normalmente este es el primer archivo que debe revisarse.

### `public/assets/js/main.js`

Es el controlador principal del frontend. Se encarga de coordinar:

- Registro e inicio de sesión.
- Cambio entre vista pública, cliente y administrador.
- Coordinación entre las vistas del cliente y administrador.
- Creación, listado y actualización de pedidos.
- Conexión con marketplace y administración.
- Conexión con los avisos en tiempo real.

No contiene toda la lógica auxiliar. Importa responsabilidades más específicas desde `marketplace.js`, `admin.js`, los módulos `core` y `receipts.js`.

### `public/assets/js/marketplace.js`

Controla el catálogo visible para clientes, la selección de quioscos, búsqueda de productos, carrito y envío del pedido.

### `public/assets/js/admin.js`

Controla el perfil del negocio, publicación y edición de productos, vista previa y mensajes del administrador.

### `public/assets/js/core/api.js`

Centraliza las solicitudes al backend.

En lugar de repetir `fetch()` y su manejo de errores en cada función, `main.js` usa:

- `request(path, method, body)`
- `post(path, body)`

También comprueba que el servidor responda JSON. Esto permite detectar cuando el servidor está apagado o desactualizado.

### `public/assets/js/core/format.js`

Contiene pequeñas funciones reutilizables:

- Convierte un ID como `15` en el código `CF-0015`.
- Traduce estados internos a textos visibles.
- Formatea fechas.
- Protege texto antes de insertarlo como HTML.
- Convierte imágenes seleccionadas a texto para enviarlas al servidor.

### `public/assets/js/receipts.js`

Controla los comprobantes:

- Abre y cierra la ventana de factura.
- Construye el contenido del comprobante.
- Descarga el comprobante como archivo HTML.
- Abre la opción de imprimir o guardar como PDF.

La factura no se guarda como un archivo independiente en PostgreSQL. Se reconstruye usando los datos guardados en `orders` y `order_items`.

## Backend: reglas y acceso a datos

### `src/server.js`

Es la puerta de entrada del backend.

Su trabajo es pequeño pero importante:

- Carga `.env`.
- Verifica la conexión con PostgreSQL.
- Inicia el servidor HTTP.

### `src/app.js`

Configura Express:

- Permite solicitudes JSON.
- Publica la carpeta `public`.
- Conecta todas las rutas bajo `/api`.
- Maneja rutas inexistentes.
- Convierte errores comunes de PostgreSQL en respuestas entendibles.
- Entrega `index.html` cuando se abre una ruta del frontend.

### `src/routes/auth.routes.js`

Maneja usuarios:

- `POST /api/register`: crea una cuenta.
- `POST /api/login`: verifica correo y contraseña.

Las contraseñas nunca se guardan directamente. `bcryptjs` las convierte en un hash.

Cuando se registra un administrador, también se crea automáticamente un quiosco vacío ligado a su usuario. Como `owner_id` es único, cada administrador solo puede tener un perfil de negocio.

### `src/routes/catalog.routes.js`

Entrega información pública al marketplace:

- `GET /api/kioscos`: devuelve únicamente quioscos publicados.
- `GET /api/productos?kioskId=...`: devuelve productos disponibles.

El cliente no necesita ver productos ocultos ni perfiles incompletos, por eso estas rutas filtran la información.

### `src/routes/admin.routes.js`

Permite que el administrador gestione su negocio:

- Consulta y actualiza el perfil del quiosco.
- Publica productos.
- Edita productos.
- Elimina productos.
- Decide si un producto está disponible.

Cuando el administrador guarda su perfil, el quiosco pasa a estar publicado y aparece en el marketplace.

### `src/routes/orders.routes.js`

Contiene la lógica de pedidos y facturas:

- Crea pedidos.
- Calcula el total usando precios de PostgreSQL.
- Devuelve pedidos del cliente.
- Devuelve pedidos recibidos por el quiosco.
- Cambia estados: pendiente, en preparación, listo y entregado.
- Permite ocultar facturas entregadas de forma independiente.
- Envía eventos en tiempo real.

El servidor vuelve a consultar los precios reales antes de guardar un pedido. Aunque el navegador envíe un total, PostgreSQL y el backend deciden el total final.

## Actualizaciones en tiempo real

### `src/realtime/order-events.js`

Mantiene una lista de navegadores conectados mediante **Server-Sent Events (SSE)**.

Cuando ocurre algo importante, `orders.routes.js` publica un evento:

- Se creó un pedido.
- Cambió el estado de un pedido.
- Una parte ocultó una factura.

El navegador correspondiente recibe el evento y actualiza la pantalla sin recargar la página.

El flujo es:

```text
Cliente envía pedido
        ↓
orders.routes.js lo guarda
        ↓
order-events.js avisa
        ↓
Administrador ve la factura inmediatamente
```

## Base de datos

### `src/db/pool.js`

Crea una conexión compartida con PostgreSQL usando `DATABASE_URL`.

Las rutas importan este archivo para ejecutar consultas sin abrir una conexión nueva manualmente cada vez.

### `src/db/schema.sql`

Define las tablas del proyecto.

#### Tabla `users`

Guarda:

- Nombre.
- Correo único.
- Contraseña protegida.
- Tipo de cuenta: cliente o administrador.

#### Tabla `kiosks`

Guarda el perfil del negocio:

- Administrador propietario.
- Nombre.
- Ubicación.
- Descripción.
- Horario.
- Imagen.
- Estado de publicación.

`owner_id` es único, por lo tanto un administrador tiene un solo quiosco.

#### Tabla `products`

Guarda los productos:

- Quiosco propietario.
- Nombre.
- Precio.
- Categoría.
- Descripción.
- Imagen.
- Disponibilidad.

#### Tabla `orders`

Guarda la información general del pedido:

- Cliente.
- Quiosco.
- Estado.
- Total.
- Fecha.
- Si el cliente ocultó su factura.
- Si el quiosco ocultó su factura.

#### Tabla `order_items`

Guarda cada producto incluido en un pedido:

- Pedido al que pertenece.
- Producto original.
- Nombre del producto al momento de comprarlo.
- Precio al momento de comprarlo.
- Cantidad.

Guardar el nombre y precio dentro de `order_items` permite conservar una factura correcta aunque el administrador edite o elimine el producto después.

## Scripts y configuración

### `.env`

Contiene valores privados de esta computadora:

```env
DATABASE_URL=postgresql://postgres:CONTRASENA@localhost:5432/cash_food
PORT=3000
```

No debe subirse a GitHub porque contiene la contraseña local.

### `scripts/configure-db.ps1`

Ayuda a configurar PostgreSQL en Windows. Crea la base de datos, prepara `.env` y ejecuta el esquema.

Se usa con:

```powershell
npm run db:configure
```

### `scripts/init-db.js`

Ejecuta `src/db/schema.sql` sobre la base configurada.

Se usa con:

```powershell
npm run db:init
```

El esquema utiliza instrucciones como `CREATE TABLE IF NOT EXISTS`, por lo que puede ejecutarse nuevamente para agregar cambios compatibles sin borrar los datos existentes.

## Qué archivo modificar según la tarea

| Quiero cambiar... | Archivo principal |
|---|---|
| Colores, tamaños o animaciones | `public/assets/css/style.css` |
| Textos y estructura visible | `public/index.html` |
| Flujo del marketplace o panel admin | `public/assets/js/main.js` |
| Descarga o diseño de comprobantes | `public/assets/js/receipts.js` |
| Comunicación del frontend con la API | `public/assets/js/core/api.js` |
| Formatos de códigos y fechas | `public/assets/js/core/format.js` |
| Registro o inicio de sesión | `src/routes/auth.routes.js` |
| Catálogo público | `src/routes/catalog.routes.js` |
| Perfil o productos del administrador | `src/routes/admin.routes.js` |
| Pedidos, estados o facturas | `src/routes/orders.routes.js` |
| Eventos en tiempo real | `src/realtime/order-events.js` |
| Tablas o columnas | `src/db/schema.sql` |
| Conexión PostgreSQL | `.env` y `src/db/pool.js` |

## Resumen del flujo de una factura

Una factura no es una imagen ni un PDF guardado. Es la combinación de:

- Información general almacenada en `orders`.
- Productos y precios almacenados en `order_items`.
- Datos del cliente en `users`.
- Datos del negocio en `kiosks`.

Cuando el usuario abre o descarga una factura, el backend reúne estos datos y el frontend construye el comprobante.

Por eso las facturas siguen disponibles después de reiniciar el proyecto, siempre que la misma base de datos PostgreSQL continúe existiendo.


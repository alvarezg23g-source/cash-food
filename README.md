# Cash Food

Aplicación web de preórdenes para quioscos y cafeterías universitarias.

## Funciones

- Registro e inicio de sesión para clientes y administradores
- Catálogo de quioscos y productos
- Carrito y envío de pedidos
- Gestión del estado de pedidos para administradores
- Perfil público editable para cada quiosco o cafetería
- Publicación de productos con categoría, precio, descripción y foto
- Disponibilidad de productos reflejada en el marketplace de clientes
- Un perfil de negocio único por cada correo administrador

## Base de datos

Cash Food utiliza PostgreSQL. Crea un archivo `.env` a partir de `.env.example` y configura la contraseña local:

```env
DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/cash_food
PORT=3000
```

Después crea automáticamente la base de datos y sus tablas:

```bash
npm run db:configure
```

Este comando solicita la contraseña local de PostgreSQL y configura `.env`. Para volver a ejecutar únicamente el esquema:

```bash
npm run db:init
```

## Ejecutar el proyecto

```bash
npm install
npm start
```

Abre `http://localhost:3000` en el navegador.

Para desarrollar con reinicio automático:

```bash
npm run dev
```

Para validar la sintaxis:

```bash
npm run check
```

## Estructura

```text
public/
  index.html                 Página principal
  assets/
    css/style.css            Estilos
    images/                  Imágenes públicas
    js/main.js               Interacciones del frontend
src/
  app.js                     Configuración de Express
  server.js                  Arranque del servidor
  db/pool.js                 Conexión PostgreSQL
  db/schema.sql              Esquema de tablas
  routes/
    auth.routes.js           Registro e inicio de sesión
    catalog.routes.js        Quioscos y productos
    orders.routes.js         Pedidos y administración
```

## Notas

Los usuarios, negocios, productos y pedidos se guardan en PostgreSQL. Las imágenes se almacenan temporalmente como texto en la base de datos; para producción conviene migrarlas a almacenamiento de archivos.

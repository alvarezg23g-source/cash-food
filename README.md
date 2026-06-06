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
  data/store.js              Datos temporales en memoria
  routes/
    auth.routes.js           Registro e inicio de sesión
    catalog.routes.js        Quioscos y productos
    orders.routes.js         Pedidos y administración
```

## Notas

Los datos y las fotos se guardan en memoria y se pierden al reiniciar el servidor. Para producción se debe agregar una base de datos, almacenamiento de imágenes y contraseñas seguras.

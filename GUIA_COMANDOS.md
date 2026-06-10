# Guia de comandos de Cash Food

Esta guia usa PowerShell en Windows.

## Primera configuracion en una computadora

Abre PowerShell y entra a la carpeta del proyecto:

```powershell
cd C:\ruta\hacia\cash-food
```

Instala las dependencias:

```powershell
npm install
```

Configura PostgreSQL y crea la base de datos `cash_food`:

```powershell
npm run db:configure
```

Cuando se solicite, escribe la contrasena del usuario `postgres`.

Inicia el proyecto:

```powershell
npm start
```

Abre en el navegador:

```text
http://localhost:3000
```

## Iniciar el proyecto normalmente

Despues de apagar o reiniciar la computadora, solamente necesitas:

```powershell
cd C:\ruta\hacia\cash-food
npm start
```

No necesitas repetir `npm install` ni `npm run db:configure`.

## Comprobar PostgreSQL

Ver el estado del servicio:

```powershell
Get-Service *postgres*
```

Iniciar PostgreSQL manualmente si esta detenido:

```powershell
Start-Service postgresql-x64-18
```

El nombre puede cambiar si tienes otra version de PostgreSQL.

## Crear o actualizar las tablas

Ejecuta el esquema definido en `src/db/schema.sql`:

```powershell
npm run db:init
```

Este comando no elimina los datos existentes.

## Entrar a la base de datos

Conectarse a `cash_food` usando PostgreSQL 18:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d cash_food
```

Escribe la contrasena del usuario `postgres` cuando se solicite.

## Consultas utiles dentro de psql

Mostrar las tablas:

```sql
\dt
```

Ver la estructura de una tabla:

```sql
\d users
\d kiosks
\d products
\d orders
```

Consultar usuarios:

```sql
SELECT id, name, email, role FROM users;
```

Consultar quioscos sin mostrar las imagenes:

```sql
SELECT id, owner_id, name, location, published FROM kiosks;
```

Consultar productos sin mostrar las imagenes:

```sql
SELECT id, kiosk_id, name, price, category, available FROM products;
```

Consultar pedidos:

```sql
SELECT id, user_id, kiosk_id, status, total, created_at FROM orders;
```

Desactivar el paginador de resultados:

```sql
\pset pager off
```

Salir de PostgreSQL:

```sql
\q
```

## Otros comandos del proyecto

Iniciar en modo desarrollo con reinicio automatico:

```powershell
npm run dev
```

Comprobar la sintaxis:

```powershell
npm run check
```

Actualizar el proyecto desde GitHub:

```powershell
git pull origin main
npm install
```

## Solucion de problemas

Si `npm` no se reconoce, instala Node.js.

Si `psql.exe` no existe en la ruta indicada, revisa la version instalada:

```powershell
Get-ChildItem "C:\Program Files\PostgreSQL"
```

Si el puerto `3000` ya esta ocupado, comprueba que Cash Food no este ejecutandose en otra terminal.

La configuracion privada de la conexion esta en `.env`. No compartas ni subas ese archivo a GitHub.

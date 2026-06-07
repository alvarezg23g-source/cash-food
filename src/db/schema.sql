CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('cliente', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kiosks (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL DEFAULT '',
  location VARCHAR(255) NOT NULL DEFAULT 'Ubicación por definir',
  description TEXT NOT NULL DEFAULT 'Completá el mini perfil para presentar tu negocio.',
  cover_image TEXT NOT NULL DEFAULT '',
  schedule VARCHAR(160) NOT NULL DEFAULT 'Horario por definir',
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  kiosk_id BIGINT NOT NULL REFERENCES kiosks(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  category VARCHAR(60) NOT NULL DEFAULT 'Comida',
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  kiosk_id BIGINT NOT NULL REFERENCES kiosks(id),
  status VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  total NUMERIC(10, 2) NOT NULL CHECK (total > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(160) NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS products_kiosk_id_idx ON products(kiosk_id);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders(user_id);
CREATE INDEX IF NOT EXISTS orders_kiosk_id_idx ON orders(kiosk_id);

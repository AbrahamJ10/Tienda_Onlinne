// server.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Sessions persistidas en Postgres (usa la misma conexión)
app.use(
  session({
    store: new pgSession({
      pool: db.pool,
      tableName: "session",
    }),
    secret: process.env.SESSION_SECRET || "esta_es_una_clave_secreta",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8, // 8 horas
    },
  })
);

// Archivos estáticos (frontend)
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------
// Helpers
// ---------------------------
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: "No autorizado" });
}

// ---------------------------
// Rutas API
// ---------------------------

// LOGIN
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Faltan credenciales" });

  try {
    const q = await db.query(
      "SELECT id, nombre, apellido, id_cargo, username, password FROM usuario WHERE username = $1",
      [username]
    );
    if (q.rowCount === 0)
      return res.status(401).json({ error: "Usuario o contraseña inválidos" });

    const user = q.rows[0];
    const stored = user.password || "";

    // Intentar bcrypt primero (por si ya está hasheada)
    let ok = false;
    try {
      ok = await bcrypt.compare(password, stored);
    } catch (e) {
      ok = false;
    }

    // Si falla bcrypt, permitir comparación directa (soporte para contraseñas en texto plano como tu ejemplo).
    if (!ok && password === stored) ok = true;

    if (!ok)
      return res.status(401).json({ error: "Usuario o contraseña inválidos" });

    // Guardar sesión (no guardar la contraseña)
    req.session.user = {
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      id_cargo: user.id_cargo,
      username: user.username,
    };

    return res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Error interno" });
  }
});

// LOGOUT
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// OBTENER USUARIO AUTENTICADO
app.get("/api/me", (req, res) => {
  if (req.session && req.session.user)
    return res.json({ user: req.session.user });
  return res.status(401).json({ error: "No autenticado" });
});

// ---------------------------
// Usuarios CRUD (ejemplos: listar, crear, borrar)
// ---------------------------
app.get("/api/usuarios", requireAuth, async (req, res) => {
  try {
    const q = await db.query(
      "SELECT u.id, u.nombre, u.apellido, u.username, c.cargo FROM usuario u LEFT JOIN cargo c ON u.id_cargo = c.id ORDER BY u.id"
    );
    res.json({ usuarios: q.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error listando usuarios" });
  }
});

app.post("/api/usuarios", requireAuth, async (req, res) => {
  const { nombre, apellido, id_cargo, username, password } = req.body;
  if (!nombre || !apellido || !username || !password)
    return res.status(400).json({ error: "Faltan campos" });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const q = await db.query(
      "INSERT INTO usuario (nombre, apellido, id_cargo, username, password) VALUES ($1,$2,$3,$4,$5) RETURNING id, nombre, apellido, username",
      [nombre, apellido, id_cargo || null, username, hashed]
    );
    res.json({ usuario: q.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creando usuario" });
  }
});

app.delete("/api/usuarios/:id", requireAuth, async (req, res) => {
  try {
    await db.query("DELETE FROM usuario WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error borrando usuario" });
  }
});

// ---------------------------
// Productos (listar, crear, borrar, obtener por id)
// ---------------------------
app.get("/api/productos", requireAuth, async (req, res) => {
  try {
    const q =
      await db.query(`SELECT p.id, p.fecha, t.tipo, m.marca, p.peso, p.descripcion, p.fv, p.stock, p.costo, p.imagen
                              FROM producto p
                              LEFT JOIN tipo t ON p.id_tipo = t.id
                              LEFT JOIN marca m ON p.id_marca = m.id
                              ORDER BY p.id`);
    res.json({ productos: q.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error listando productos" });
  }
});

app.post("/api/productos", requireAuth, async (req, res) => {
  const { id_tipo, id_marca, peso, descripcion, fv, stock, costo, imagen } =
    req.body;
  try {
    const q = await db.query(
      `INSERT INTO producto (id_tipo, id_marca, peso, descripcion, fv, stock, costo, imagen)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        id_tipo || null,
        id_marca || null,
        peso || null,
        descripcion || null,
        fv || null,
        stock || 0,
        costo || 0,
        imagen || null,
      ]
    );
    res.json({ producto: q.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creando producto" });
  }
});

app.delete("/api/productos/:id", requireAuth, async (req, res) => {
  try {
    await db.query("DELETE FROM producto WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error borrando producto" });
  }
});

// ---------------------------
// Configuracion (ejemplo: listar cargos, tipos, marcas)
// ---------------------------
app.get("/api/config/cargos", requireAuth, async (req, res) => {
  try {
    const q = await db.query("SELECT * FROM cargo ORDER BY id");
    res.json({ cargos: q.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

app.get("/api/config/tipos", requireAuth, async (req, res) => {
  try {
    const q = await db.query("SELECT * FROM tipo ORDER BY id");
    res.json({ tipos: q.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

app.get("/api/config/marcas", requireAuth, async (req, res) => {
  try {
    const q = await db.query("SELECT * FROM marca ORDER BY id");
    res.json({ marcas: q.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

// ---------------------------
// Fallback: sirve dashboard
// ---------------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---------------------------
app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});

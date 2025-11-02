// ============================================================
// 🌐 TIENDA M&S - Servidor Express + PostgreSQL + Cloudinary
// ============================================================

import express from "express";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";

dotenv.config();
const app = express();
//const PORT = 3000;
const PORT = process.env.PORT || 3000;

// ============================================================
// 🧩 MIDDLEWARES (ORDEN CORRECTO)
// ============================================================
app.use(
  cors({
    origin: "*", // permite peticiones desde Android (10.0.2.2)
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json()); // 🟢 necesario para parsear JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join("public")));

// ============================================================
// 🗄️ CONEXIÓN A POSTGRESQL (Neon o local)
// ============================================================
const pool = new Pool({
  connectionString: `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}/${process.env.PGDATABASE}?sslmode=require`,
});

pool.on("error", (err) =>
  console.error("❌ Error en PostgreSQL:", err.message)
);

// ============================================================
// ⚙️ SESIONES
// ============================================================
const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({ pool }),
    secret: process.env.SESSION_SECRET || "secreto_tienda_ms",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 2 }, // 2h
  })
);

// ============================================================
// ☁️ CONFIGURACIÓN CLOUDINARY
// ============================================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "productos_tienda_ms",
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});
const upload = multer({ storage });

// ============================================================
// 🧩 MIDDLEWARES
// ============================================================
app.use(express.static(path.join("public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de protección
function verificarSesion(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "No autorizado" });
  }
  next();
}

// ============================================================
// 👤 LOGIN / LOGOUT
// ============================================================

// 🔐 LOGIN
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("🧠 Usuario recibido:", username);
    console.log("🔑 Password recibido:", password);

    const result = await pool.query(
      "SELECT * FROM usuario WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      console.log("🚫 Usuario no encontrado en BD");
      return res.status(400).json({ error: "Usuario no encontrado" });
    }

    const user = result.rows[0];
    console.log("💾 Hash en BD:", user.password);

    const passwordValida = await bcrypt.compare(password, user.password);
    console.log("✅ Resultado comparación:", passwordValida);

    if (!passwordValida) {
      console.log("❌ Contraseña incorrecta");
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    req.session.user = {
      id: user.id,
      nombre: user.nombre,
      username: user.username,
    };

    console.log("🎉 Login exitoso para:", user.username);
    res.json({ mensaje: "Inicio de sesión exitoso" });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ error: "Error interno en login" });
  }
});

// 🚪 LOGOUT
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ mensaje: "Sesión cerrada" });
  });
});

// ============================================================
// 📦 PRODUCTOS
// ============================================================
// SIN verificarSesion para permitir acceso desde Android
//app.get("/api/productos", async (req, res) => {
app.get("/api/productos", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, t.tipo, m.marca
       FROM producto p
       LEFT JOIN tipo t ON p.id_tipo = t.id
       LEFT JOIN marca m ON p.id_marca = m.id
       ORDER BY p.id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

app.post(
  "/api/productos",
  verificarSesion,
  upload.single("imagen"),
  async (req, res) => {
    try {
      const { id_tipo, id_marca, peso, descripcion, fv, stock, costo, estado } =
        req.body;
      const imagenUrl = req.file ? req.file.path : null;

      const idResult = await pool.query(
        "SELECT 'PRO' || LPAD(nextval('seq_producto')::text, 7, '0') AS id"
      );
      const idGenerado = idResult.rows[0].id;

      const result = await pool.query(
        `INSERT INTO producto (id, id_tipo, id_marca, peso, descripcion, fv, stock, costo, imagen)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
        [
          idGenerado,
          id_tipo || null,
          id_marca || null,
          peso || null,
          descripcion || null,
          fv || null,
          stock || 0,
          costo || 0,
          imagenUrl,
        ]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error al crear producto:", err);
      res.status(500).json({ error: "Error al guardar producto" });
    }
  }
);

app.put(
  "/api/productos/:id",
  verificarSesion,
  upload.single("imagen"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { id_tipo, id_marca, peso, descripcion, fv, stock, costo, estado } =
        req.body;

      const resultImg = await pool.query(
        "SELECT imagen FROM producto WHERE id=$1",
        [id]
      );
      const imagenActual = resultImg.rows[0]?.imagen;
      const imagenFinal = req.file ? req.file.path : imagenActual;

      const result = await pool.query(
        `UPDATE producto SET id_tipo=$1,id_marca=$2,peso=$3,descripcion=$4,fv=$5,
       stock=$6,costo=$7,imagen=$8 WHERE id=$9 RETURNING *`,
        [
          id_tipo || null,
          id_marca || null,
          peso || null,
          descripcion || null,
          fv || null,
          stock || 0,
          costo || 0,
          imagenFinal,
          id,
        ]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error al actualizar producto:", err);
      res.status(500).json({ error: "Error al actualizar producto" });
    }
  }
);

app.delete("/api/productos/:id", verificarSesion, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM producto WHERE id=$1", [id]);
    res.json({ mensaje: "Producto eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar producto" });
  }
});

// ============================================================
// 🏷️ TIPOS Y MARCAS
// ============================================================
/*
app.get("/api/tipos", verificarSesion, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, tipo FROM tipo ORDER BY tipo");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener tipos" });
  }
});
*/

app.get("/api/tipos", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, tipo FROM tipo ORDER BY tipo");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener tipos" });
  }
});

app.post("/api/tipos", verificarSesion, async (req, res) => {
  try {
    const { tipo } = req.body;
    const result = await pool.query(
      "INSERT INTO tipo (tipo) VALUES ($1) RETURNING id, tipo",
      [tipo]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al agregar tipo" });
  }
});

app.delete("/api/tipos/:id", verificarSesion, async (req, res) => {
  try {
    await pool.query("DELETE FROM tipo WHERE id=$1", [req.params.id]);
    res.json({ mensaje: "Tipo eliminado correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar tipo" });
  }
});

/*
app.get("/api/marcas", verificarSesion, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, marca FROM marca ORDER BY marca"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener marcas" });
  }
});
*/
app.get("/api/marcas", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, marca FROM marca ORDER BY marca"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener marcas" });
  }
});

app.post("/api/marcas", verificarSesion, async (req, res) => {
  try {
    const { marca } = req.body;
    const result = await pool.query(
      "INSERT INTO marca (marca) VALUES ($1) RETURNING id, marca",
      [marca]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al agregar marca" });
  }
});

app.delete("/api/marcas/:id", verificarSesion, async (req, res) => {
  try {
    await pool.query("DELETE FROM marca WHERE id=$1", [req.params.id]);
    res.json({ mensaje: "Marca eliminada correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar marca" });
  }
});

// ============================================================
// 🚀 INICIAR SERVIDOR
// ============================================================
// ============================================================
// ✅ CORS para permitir peticiones desde Android / navegadores
// ============================================================

app.use(
  cors({
    origin: "*", // permite cualquier origen (ajusta si deseas más seguridad)
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ============================================================
// 🚀 INICIAR SERVIDOR - ESCUCHA EN TODAS LAS INTERFACES
// ============================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🌐 También accesible desde emulador en http://10.0.2.2:${PORT}`);
});

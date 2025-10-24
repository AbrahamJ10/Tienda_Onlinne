// db.js
require("dotenv").config();
const { Pool } = require("pg");

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_Ok3rfPznd4KV@ep-mute-wildflower-a4m5h9iw-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const pool = new Pool({
  connectionString,
  // Neon typically requires ssl; PG will read sslmode=require from the connection string.
  // Si necesitas forzar ssl: uncomment siguiente bloque:
  // ssl: { rejectUnauthorized: false }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};

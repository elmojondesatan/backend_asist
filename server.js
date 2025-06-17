import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./rutas/auth.js";
import pool from "./config/conexion.js";
import process from "process";  // ← IMPORTANTE

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
app.use("/", authRoutes);

// Verificar conexión
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Conexión MySQL correcta");
  } catch (err) {
    console.error("❌ Error al conectar a MySQL:", err);
  }
})();

app.listen(PORT, () => {
  console.log(🚀 API lista en http://localhost:${PORT});
});


// 🔻 ESTE BLOQUE al final para cerrar el pool correctamente
process.on("SIGINT", async () => {
  await pool.end();
  console.log("🛑 Conexiones MySQL cerradas (SIGINT)");
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await pool.end();
  console.log("🛑 Conexiones MySQL cerradas (SIGTERM)");
  process.exit(0);
});
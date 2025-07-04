import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./rutas/auth.js";
import pool from "./config/conexion.js";
import asistenciaRouter from "./rutas/asistencia.js"
import process from "process";  // ← IMPORTANTE

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
app.use("/", authRoutes);
app.use("/asistencias", asistenciaRouter);

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
  console.log(`🚀 API lista en http://localhost:${PORT}`);
});


// Añadir manejo de errores global
app.use((err, req, res, next) => {
  console.error('🔥 Error global:', err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Cerrar pool adecuadamente
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, async () => {
    console.log(`🛑 Recibida ${signal}`);
    await pool.end();
    console.log('🔒 Conexiones MySQL cerradas');
    process.exit(0);
  });
});
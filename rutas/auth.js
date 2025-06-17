auth.js
// backend/rutas/auth.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/conexion.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  const { nombre, correo, password } = req.body;
  let conn;

  try {
    conn = await pool.getConnection();

    const [existing] = await conn.query(
      "SELECT id FROM usuarios WHERE correo = ?",
      [correo]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "El correo ya está registrado." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await conn.query(
      "INSERT INTO usuarios (nombre, correo, password) VALUES (?, ?, ?)",
      [nombre, correo, hashedPassword]
    );

    res.json({ success: true, message: "Usuario registrado con éxito" });
  } catch (err) {
    if (err.code === "ER_USER_LIMIT_REACHED") {
      return res.status(503).json({ mensaje: "Ya se usaron las 5 conexiones disponibles." });
    }
    console.error("Error en registro:", err);
    res.status(500).json({ message: "Error del servidor" });
  } finally {
    if (conn) conn.release();
  }
});

router.post("/login", async (req, res) => {
  const { correo, password } = req.body;
  let conn;

  try {
    conn = await pool.getConnection();

    const [rows] = await conn.query("SELECT * FROM usuarios WHERE correo = ?", [correo]);
    if (rows.length === 0) {
      return res.status(401).json({ mensaje: "Correo no registrado" });
    }

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ mensaje: "Contraseña incorrecta" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "2h" });

    res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        correo: user.correo
      }
    });
  } catch (err) {
    if (err.code === "ER_USER_LIMIT_REACHED") {
      return res.status(503).json({ mensaje: "Ya se usaron las 5 conexiones disponibles." });
    }
    console.error("Error en login:", err);
    res.status(500).json({ mensaje: "Error del servidor" });
  } finally {
    if (conn) conn.release();
  }
});

router.post("/recover", async (req, res) => {
  const { correo } = req.body;
  let conn;

  try {
    conn = await pool.getConnection();

    const [rows] = await conn.query("SELECT * FROM usuarios WHERE correo = ?", [correo]);

    if (rows.length === 0) {
      return res.status(404).json({ mensaje: "Correo no encontrado" });
    }

    const nuevaPassword = Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(nuevaPassword, 10);

    await conn.query("UPDATE usuarios SET password = ? WHERE correo = ?", [hashed, correo]);

    console.log(🔐 Nueva contraseña para ${correo}: ${nuevaPassword});
    res.json({ mensaje: "Nueva contraseña generada (ver consola)" });
  } catch (err) {
    if (err.code === "ER_USER_LIMIT_REACHED") {
      return res.status(503).json({ mensaje: "Ya se usaron las 5 conexiones disponibles." });
    }
    console.error("Error en recuperación:", err);
    res.status(500).json({ mensaje: "Error del servidor" });
  } finally {
    if (conn) conn.release();
  }
});

export default router;
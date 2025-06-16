require("dotenv").config();
const express  = require("express");
const mysql    = require("mysql2/promise");
const bcrypt   = require("bcrypt");
const jwt      = require("jsonwebtoken");
const cors     = require("cors");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(express.json());

/* ------------  Conexión MySQL (pool)  ------------ */
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port:     process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
});

/* ------------ Verificar conexión al iniciar ------------ */
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Conexión MySQL correcta");
  } catch (e) {
    console.error("❌ Error de conexión MySQL:", e.message);
  }
})();

/* ------------  Mailer  ------------ */
const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* ------------  Middleware JWT  ------------ */
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token requerido" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Token inválido" });
  }
};

/* ================================================= */
/*                   ENDPOINTS                       */
/* ================================================= */

/* ----------  AUTH  ---------- */
app.post("/register", async (req, res) => {
  const { nombre, correo, password } = req.body;
  if (!nombre || !correo || !password)
    return res.status(400).json({ message: "Campos faltantes" });

  const [[dup]] = await pool.query("SELECT id FROM users WHERE correo = ?", [correo]);
  if (dup) return res.status(409).json({ message: "Correo ya registrado" });

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    "INSERT INTO users(nombre, correo, password) VALUES(?,?,?)",
    [nombre, correo, hash]
  );
  res.json({ message: "Usuario creado" });
});

app.post("/login", async (req, res) => {
  const { correo, password } = req.body;
  const [[user]] = await pool.query("SELECT * FROM users WHERE correo = ?", [correo]);

  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ message: "Credenciales inválidas" });

  const token = jwt.sign({ id: user.id, nombre: user.nombre }, process.env.JWT_SECRET, {
    expiresIn: "8h"
  });
  res.json({ token, user: { id: user.id, nombre: user.nombre } });
});

app.post("/recover", async (req, res) => {
  const { correo } = req.body;
  const [[user]] = await pool.query("SELECT * FROM users WHERE correo = ?", [correo]);
  if (!user) return res.status(404).json({ message: "No existe el usuario" });

  const nueva = Math.random().toString(36).slice(-8);
  const hash = await bcrypt.hash(nueva, 10);
  await pool.query("UPDATE users SET password = ? WHERE id = ?", [hash, user.id]);

  await mailer.sendMail({
    from: process.env.EMAIL_USER,
    to: correo,
    subject: "Recuperación de contraseña",
    text: `Tu nueva contraseña es: ${nueva}`
  });

  res.json({ message: "Contraseña enviada al correo" });
});

/* ----------  ALUMNOS  ---------- */
app.post("/students", auth, async (req, res) => {
  const { nombre, grado } = req.body;
  await pool.query(
    "INSERT INTO students(nombre, grado, user_id) VALUES(?,?,?)",
    [nombre, grado, req.user.id]
  );
  res.json({ message: "Alumno añadido" });
});

app.get("/students", auth, async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM students WHERE user_id = ?", [req.user.id]);
  res.json(rows);
});

/* ----------  ASISTENCIA  ---------- */
app.post("/asistencia", auth, async (req, res) => {
  const { student_id, estado, motivo } = req.body;
  await pool.query(
    "INSERT INTO asistencia(student_id, fecha, estado, motivo) VALUES(?,?,?,?)",
    [student_id, new Date(), estado, motivo]
  );
  res.json({ message: "Asistencia registrada" });
});

app.get("/asistencia", auth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT a.*, s.nombre FROM asistencia a
     JOIN students s ON s.id = a.student_id
     WHERE s.user_id = ?`,
    [req.user.id]
  );
  res.json(rows);
});

/* ----------  UNIFORME  ---------- */
app.post("/uniforme", auth, async (req, res) => {
  const { student_id, camisa, pantalon, zapatos, motivo } = req.body;
  await pool.query(
    "INSERT INTO uniforme(student_id, fecha, camisa, pantalon, zapatos, motivo) VALUES(?,?,?,?,?,?)",
    [student_id, new Date(), camisa, pantalon, zapatos, motivo]
  );
  res.json({ message: "Uniforme registrado" });
});

app.get("/uniforme", auth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.*, s.nombre FROM uniforme u
     JOIN students s ON s.id = u.student_id
     WHERE s.user_id = ?`,
    [req.user.id]
  );
  res.json(rows);
});

/* ----------  SERVER ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API lista en http://localhost:${PORT}`));

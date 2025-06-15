require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// Habilitar CORS solo para tu frontend específico
app.use(cors({
  origin: 'http://127.0.0.1:5500'  // Asegúrate de que este sea el origen de tu frontend
}));

// Middleware para parsear el cuerpo de la solicitud
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Conexión a MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  multipleStatements: true
});

db.connect((err) => {
  if (err) {
    console.error('Error de conexión a la base de datos:', err);
    return;
  }
  console.log('Conexión exitosa a la base de datos');
});

// Middleware de autenticación
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Ruta para obtener los profesores
app.get('/profesores', (req, res) => {
  db.query('SELECT * FROM profesor', (err, results) => {
    if (err) {
      console.error('Error al obtener profesores:', err);
      return res.status(500).json({ error: 'Error en la base de datos' });
    }
    res.json(results);
  });
});

// Ruta para realizar el login
app.post('/login', (req, res) => {
  const { correo, contraseña } = req.body;

  if (!correo || !contraseña) {
    return res.status(400).json({ mensaje: 'Campos requeridos' });
  }

  db.query('SELECT * FROM profesor WHERE correo = ?', [correo], async (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error en base de datos' });

    if (results.length === 0) {
      return res.status(401).json({ mensaje: 'Correo no registrado' });
    }

    const user = results[0];

    const match = await bcrypt.compare(contraseña, user.contraseña);

    if (!match) {
      return res.status(401).json({ mensaje: 'Contraseña incorrecta' });
    }

    const token = jwt.sign({ id: user.id_profesor, correo: user.correo }, JWT_SECRET, {
      expiresIn: '1h'
    });

    res.json({ token, nombre: user.nombre });
  });
});

// Ruta para guardar la asistencia de un alumno
app.post('/guardar-asistencia', authenticateToken, (req, res) => {
  const { id_alumno, estado, motivo } = req.body;

  if (!id_alumno || !estado || !motivo) {
    return res.status(400).json({ mensaje: 'Campos incompletos' });
  }

  const fecha = new Date().toISOString().split('T')[0];  // Fecha actual en formato YYYY-MM-DD

  const query = 'INSERT INTO asistencia (id_alumno, fecha, estado, motivo) VALUES (?, ?, ?, ?)';
  db.query(query, [id_alumno, fecha, estado, motivo], (err, result) => {
    if (err) {
      console.error('Error al guardar asistencia:', err);
      return res.status(500).json({ mensaje: 'Error al guardar asistencia' });
    }
    res.status(201).json({ mensaje: 'Asistencia guardada correctamente' });
  });
});

// Ruta para registrar un nuevo usuario
app.post('/api/register', async (req, res) => {
  const { correo, contraseña } = req.body;

  if (!correo || !contraseña) {
    return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
  }

  // Verificar si el correo ya está registrado
  db.query('SELECT * FROM profesor WHERE correo = ?', [correo], async (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error en la base de datos' });

    if (results.length > 0) {
      return res.status(400).json({ mensaje: 'El correo ya está registrado' });
    }

    // Encriptar la contraseña antes de guardarla
    const hashedPassword = await bcrypt.hash(contraseña, 10);

    const query = 'INSERT INTO profesor (correo, contraseña) VALUES (?, ?)';
    db.query(query, [correo, hashedPassword], (err, result) => {
      if (err) {
        console.error('Error al registrar el usuario:', err);
        return res.status(500).json({ mensaje: 'Error al registrar el usuario' });
      }
      res.status(201).json({ mensaje: 'Usuario registrado correctamente' });
    });
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

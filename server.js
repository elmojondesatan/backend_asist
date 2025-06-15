require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors({
  origin: 'http://127.0.0.1:5500'
}));
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

app.get('/profesores', (req, res) => {
    db.query('SELECT * FROM profesor', (err, results) => {
      if (err) {
        console.error('Error al obtener profesores:', err);
        return res.status(500).json({ error: 'Error en la base de datos' });
      }
      res.json(results);
    });
  });
  
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
  
import { Router } from "express";
import pool from "../config/conexion.js";

const router = Router();

// Obtener lista de alumnos
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM alumnos");
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error al obtener alumnos:", error);
    res.status(500).json({ message: "Error al obtener alumnos" });
  }
});

// Crear un nuevo alumno
router.post("/", async (req, res) => {
  const { nombre, apellido, correo, grado_id } = req.body;

  try {
    const [result] = await pool.query(
      "INSERT INTO alumnos (nombre, apellido, correo, grado_id) VALUES (?, ?, ?, ?)",
      [nombre, apellido, correo, grado_id]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error("Error al crear alumno:", error);
    res.status(500).json({ message: "Error al crear alumno" });
  }
});

export default router;

import { Router } from "express";
import pool from "../config/conexion.js";

const router = Router();

router.post("/guardar", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const datos = Array.isArray(req.body) ? req.body : [req.body];
    const hoy = new Date().toISOString().split("T")[0];

    // 1. Validación de datos
    const datosFiltrados = datos.filter(a => {
      const valido = a.nombre && a.profesor_id;
      if (!valido) {
        console.error("❌ Datos inválidos:", a);
      }
      return valido;
    });

    // 2. Obtener IDs de alumnos existentes
    const nombres = [...new Set(datosFiltrados.map(a => a.nombre))];
    const [alumnosExistentes] = await connection.query(
      "SELECT id, nombre FROM alumnos WHERE nombre IN (?)",
      [nombres]
    );

    // 3. Insertar nuevos alumnos
    const nombresExistentes = alumnosExistentes.map(a => a.nombre);
    const nuevosNombres = nombres.filter(n => !nombresExistentes.includes(n));
    
    if (nuevosNombres.length > 0) {
      await connection.query(
        "INSERT INTO alumnos (nombre) VALUES ?",
        [nuevosNombres.map(n => [n])]
      );
    }

    // 4. Obtener todos los IDs de alumnos
    const [todosAlumnos] = await connection.query(
      "SELECT id, nombre FROM alumnos WHERE nombre IN (?)",
      [nombres]
    );
    const mapaAlumnos = new Map(todosAlumnos.map(a => [a.nombre, a.id]));

    // 5. Preparar datos de asistencias
    const asistencias = datosFiltrados.map(a => [
      mapaAlumnos.get(a.nombre),
      a.profesor_id,
      hoy,
      a.presente ?? 0,
      a.uniforme_ok ?? 0,
      a.camisa_ok ?? 0,
      a.pantalon_ok ?? 0,
      a.zapatos_ok ?? 0,
      a.motivo ?? null
    ]);

    // 6. Upsert (insertar o actualizar)
    await connection.query(`
      INSERT INTO asistencias (
        alumno_id, profesor_id, fecha, presente, 
        uniforme_ok, camisa_ok, pantalon_ok, zapatos_ok, motivo
      ) VALUES ?
      ON DUPLICATE KEY UPDATE
        profesor_id = VALUES(profesor_id),
        presente = VALUES(presente),
        uniforme_ok = VALUES(uniforme_ok),
        camisa_ok = VALUES(camisa_ok),
        pantalon_ok = VALUES(pantalon_ok),
        zapatos_ok = VALUES(zapatos_ok),
        motivo = VALUES(motivo)
    `, [asistencias]);

    await connection.commit();
    res.status(200).json({ message: "Asistencias guardadas correctamente" });
  } catch (error) {
    await connection.rollback();
    console.error("❌ Error transacción:", error);
    res.status(500).json({ 
      message: "Error al guardar asistencias",
      error: error.message
    });
  } finally {
    connection.release();
  }
});

export default router;
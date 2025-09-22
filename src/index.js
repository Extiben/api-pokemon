import express from "express";
import cors from "cors";
import morgan from "morgan";
import { v4 as uuidv4 } from "uuid";
import methodOverride from "method-override";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

// Archivos estáticos (frontend en /public)
app.use(express.static(path.join(__dirname, "../public")));

// Configuración de la BD
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "pokemon_api",
});

// Helper: obtener URL oficial de imagen desde PokéAPI
const getImageUrl = (pokeApiId) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeApiId}.png`;

// ======================= RUTAS ======================= //

// GET todos los pokémon
app.get("/pokemons", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM pokemons");
    const withImages = rows.map((p) => ({
      ...p,
      imagen: p.pokeapi_id ? getImageUrl(p.pokeapi_id) : null,
    }));
    res.json(withImages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET por id
app.get("/pokemons/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM pokemons WHERE id = ?", [
      req.params.id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Pokémon no encontrado" });
    }

    const p = rows[0];
    res.json({
      ...p,
      imagen: p.pokeapi_id ? getImageUrl(p.pokeapi_id) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST nuevo pokémon
app.post("/pokemons", async (req, res) => {
  try {
    const { nombre, tipo, nivel, pokeapi_id } = req.body;

    if (!nombre || !tipo || nivel == null || !pokeapi_id) {
      return res
        .status(400)
        .json({ error: "Todos los campos son requeridos (incluido pokeapi_id)" });
    }

    const nivelNum = Number(nivel);
    if (Number.isNaN(nivelNum)) {
      return res.status(400).json({ error: "nivel debe ser numérico" });
    }

    const id = uuidv4();
    const version = 1;

    await pool.query(
      "INSERT INTO pokemons (id, nombre, tipo, nivel, version, pokeapi_id) VALUES (?, ?, ?, ?, ?, ?)",
      [id, nombre, tipo, nivelNum, version, pokeapi_id]
    );

    res.status(201).json({
      id,
      nombre,
      tipo,
      nivel: nivelNum,
      version,
      pokeapi_id,
      imagen: getImageUrl(pokeapi_id),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar pokémon
app.put("/pokemons/:id", async (req, res) => {
  try {
    const { nombre, tipo, nivel } = req.body;

    const [rows] = await pool.query("SELECT * FROM pokemons WHERE id = ?", [
      req.params.id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Pokémon no encontrado" });
    }

    const p = rows[0];
    const newNombre = nombre || p.nombre;
    const newTipo = tipo || p.tipo;
    const newNivel = nivel != null ? Number(nivel) : p.nivel;
    if (nivel != null && Number.isNaN(newNivel)) {
      return res.status(400).json({ error: "nivel debe ser numérico" });
    }

    const newVersion = p.version + 1;

    await pool.query(
      "UPDATE pokemons SET nombre=?, tipo=?, nivel=?, version=? WHERE id=?",
      [newNombre, newTipo, newNivel, newVersion, req.params.id]
    );

    res.json({
      id: req.params.id,
      nombre: newNombre,
      tipo: newTipo,
      nivel: newNivel,
      version: newVersion,
      pokeapi_id: p.pokeapi_id,
      imagen: getImageUrl(p.pokeapi_id),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE pokémon
app.delete("/pokemons/:id", async (req, res) => {
  try {
    const [result] = await pool.query("DELETE FROM pokemons WHERE id = ?", [
      req.params.id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Pokémon no encontrado" });
    }
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================= SERVIDOR ======================= //
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`)
);

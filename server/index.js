import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { calculateTaxware } from "./taxwareProxy.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.send("OK");
});

app.post("/api/taxware/calculate", async (req, res) => {
  try {
    const data = await calculateTaxware(req.body);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Erreur serveur",
      ...(error.details ? { details: error.details } : {}),
    });
  }
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

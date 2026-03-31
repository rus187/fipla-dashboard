import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config({ path: "./src/server/.env" });

const app = express();
app.use(cors());
app.use(express.json());

function basicAuthHeader() {
  const username = process.env.TAXWARE_USERNAME?.trim();
  const password = process.env.TAXWARE_PASSWORD?.trim();

  if (!username || !password) {
    throw new Error("Identifiants TaxWare manquants");
  }

  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

app.post("/api/taxware/simulate", async (req, res) => {
  console.log(">>> REQUETE RECUE PAR LE SERVEUR TAXWARE");
  try {
    const payload = req.body;

    console.log("PAYLOAD ENVOYÉ À TAXWARE =", JSON.stringify(payload, null, 2));

    const response = await fetch(process.env.TAXWARE_API_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Erreur TaxWare",
        details: data,
      });
    }

    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Erreur serveur",
    });
  }
});

const PORT = 3001;

app.listen(PORT, () => {
  console.log("Serveur TaxWare lancé sur http://localhost:" + PORT);
});

import { Router } from "express";
import fetch from "node-fetch";

const router = Router();

const isProduction = () => process.env.NODE_ENV === "production";

function basicAuthHeader() {
  const username = process.env.TAXWARE_USERNAME?.trim();
  const password = process.env.TAXWARE_PASSWORD?.trim();

  if (!username || !password) {
    throw new Error("Identifiants TaxWare manquants");
  }

  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

router.post("/api/runtime-debug", (req, res) => {
  if (isProduction()) {
    return res.status(404).json({ error: "Not found" });
  }
  console.log("[RUNTIME DEBUG]", JSON.stringify(req.body ?? {}, null, 2));
  return res.json({ ok: true });
});

router.post("/api/taxware/simulate", async (req, res) => {
  if (!isProduction()) {
    console.log(">>> REQUETE RECUE PAR LE SERVEUR TAXWARE");
  }
  try {
    const payload = req.body;

    if (!isProduction()) {
      console.log("PAYLOAD ENVOYÉ À TAXWARE =", JSON.stringify(payload, null, 2));
    }

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

router.post("/api/taxware/from-bases", async (req, res) => {
  const v2Url = process.env.TAXWARE_V2_API_URL?.trim();
  if (!v2Url) {
    return res.status(503).json({ error: "TAXWARE_V2_API_URL non configurée" });
  }

  const { zip, city, year, partnership, numChildren, taxableIncomeFederal, taxableIncomeCanton, taxableAssets } = req.body ?? {};

  if (!zip || !city || !year || !partnership) {
    return res.status(400).json({ error: "Champs requis manquants : zip, city, year, partnership" });
  }
  if (!["Single", "Marriage"].includes(partnership)) {
    return res.status(400).json({ error: "partnership doit être 'Single' ou 'Marriage'" });
  }
  if (typeof taxableIncomeFederal !== "number" || typeof taxableIncomeCanton !== "number" || typeof taxableAssets !== "number") {
    return res.status(400).json({ error: "taxableIncomeFederal, taxableIncomeCanton et taxableAssets doivent être des nombres" });
  }
  if (taxableIncomeFederal < 0 || taxableIncomeCanton < 0 || taxableAssets < 0) {
    return res.status(400).json({ error: "Les bases imposables ne peuvent pas être négatives" });
  }

  const v2Payload = {
    Year: Number(year),
    Partnership: partnership,
    NumChildren: typeof numChildren === "number" ? Math.max(0, Math.round(numChildren)) : 0,
    Zip: Number(zip),
    City: String(city),
    IncomeTaxParameters: {
      TaxableIncomeFederation: taxableIncomeFederal,
      TaxableIncomeCanton: taxableIncomeCanton,
    },
    AssetTaxParameters: {
      TaxableAssets: taxableAssets,
    },
  };

  if (!isProduction()) {
    console.log("[TAXWARE V2] PAYLOAD ENVOYÉ =", JSON.stringify(v2Payload, null, 2));
  }

  try {
    const response = await fetch(v2Url, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(v2Payload),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    if (!isProduction()) {
      console.log("[TAXWARE V2] RÉPONSE BRUTE =", JSON.stringify(data, null, 2));
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: "Erreur TaxWare V2", details: data });
    }

    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Erreur serveur V2" });
  }
});

export default router;

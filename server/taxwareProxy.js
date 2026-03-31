import fetch from "node-fetch";

function basicAuthHeader() {
  const username = process.env.TAXWARE_USERNAME?.trim();
  const password = process.env.TAXWARE_PASSWORD?.trim();

  if (!username || !password) {
    throw new Error("Identifiants TaxWare manquants");
  }

  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

export async function calculateTaxware(payload) {
  const apiUrl = process.env.TAXWARE_API_URL?.trim();

  if (!apiUrl) {
    throw new Error("TAXWARE_API_URL manquante");
  }

  const response = await fetch(apiUrl, {
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
    const error = new Error("Erreur TaxWare");
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

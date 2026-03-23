const fs = require("fs");
const path = require("path");

const inputFile = path.join(__dirname, "EtatCommunes.csv");
const outputFile = path.join(__dirname, "communes_clean.json");

const raw = fs.readFileSync(inputFile, "utf8");
const lines = raw.split(/\r?\n/).filter(Boolean);

const header = lines[0].split(";").map((h) => h.trim());

const idxCanton = header.indexOf("Canton");
const idxOfs = header.indexOf("Numéro de la commune");
const idxName = header.indexOf("Nom de la commune");
const idxDate = header.findIndex((h) => h.startsWith("Date de l'inscription"));

if (idxCanton === -1 || idxOfs === -1 || idxName === -1 || idxDate === -1) {
  throw new Error("Colonnes introuvables dans EtatCommunes.csv");
}

const latestByOfs = new Map();

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(";").map((c) => c.trim());

  const canton = cols[idxCanton];
  const ofs = cols[idxOfs];
  const name = cols[idxName];
  const date = cols[idxDate];

  if (!ofs || !name || !canton) continue;

  const existing = latestByOfs.get(ofs);

  if (!existing || date > existing.date) {
    latestByOfs.set(ofs, {
      ofs: Number(ofs),
      name,
      canton,
      date,
    });
  }
}

const cleaned = Array.from(latestByOfs.values())
  .map(({ ofs, name, canton }) => ({
    ofs,
    name,
    canton,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));

fs.writeFileSync(outputFile, JSON.stringify(cleaned, null, 2), "utf8");

console.log(`Fichier créé : ${outputFile}`);
console.log(`Nombre de communes : ${cleaned.length}`);
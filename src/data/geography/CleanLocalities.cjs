const fs = require("fs");
const path = require("path");

const inputFile = path.join(__dirname, "swiss-localities.csv");
const outputFile = path.join(__dirname, "localities_clean.json");

const raw = fs.readFileSync(inputFile, "utf8");
const lines = raw.split(/\r?\n/).filter(Boolean);

const header = lines[0].split(";").map((h) => h.trim());

console.log("Colonnes détectées :", header);

const idxZip = header.findIndex((h) =>
  /postal|npa|zip|plz/i.test(h)
);
const idxLocality = header.findIndex((h) =>
  /localit|ortschaft|lieu/i.test(h)
);
const idxCanton = header.findIndex((h) =>
  /canton/i.test(h)
);
const idxOfs = header.findIndex((h) =>
  /ofs|bfs|commune/i.test(h)
);

if (idxZip === -1 || idxLocality === -1) {
  throw new Error("Impossible de trouver les colonnes NPA et localité dans swiss-localities.csv");
}

const rows = [];

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(";").map((c) => c.trim());

  const zip = cols[idxZip] || "";
  const locality = cols[idxLocality] || "";
  const canton = idxCanton >= 0 ? cols[idxCanton] || "" : "";
  const ofsRaw = idxOfs >= 0 ? cols[idxOfs] || "" : "";

  if (!zip || !locality) continue;

  rows.push({
    zip,
    locality,
    canton,
    ofs: ofsRaw && !isNaN(Number(ofsRaw)) ? Number(ofsRaw) : null,
  });
}

fs.writeFileSync(outputFile, JSON.stringify(rows, null, 2), "utf8");

console.log(`Fichier créé : ${outputFile}`);
console.log(`Nombre de lignes : ${rows.length}`);
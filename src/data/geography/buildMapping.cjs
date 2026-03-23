const fs = require("fs");
const path = require("path");

const communesFile = path.join(__dirname, "communes_clean.json");
const localitiesFile = path.join(__dirname, "localities_clean.json");
const outputFile = path.join(__dirname, "zip-to-fiscal.json");

const communes = JSON.parse(fs.readFileSync(communesFile, "utf8"));
const localities = JSON.parse(fs.readFileSync(localitiesFile, "utf8"));

const communesByOfs = new Map(
  communes.map((c) => [String(c.ofs), c])
);

const result = [];

for (const loc of localities) {
  const ofsKey = loc.ofs != null ? String(loc.ofs) : null;
  const commune = ofsKey ? communesByOfs.get(ofsKey) : null;

  result.push({
    zip: loc.zip,
    locality: loc.locality,
    localityCanton: loc.canton || "",
    ofs: loc.ofs,
    fiscalCommune: commune ? commune.name : null,
    fiscalCanton: commune ? commune.canton : loc.canton || "",
  });
}

fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), "utf8");

console.log(`Fichier créé : ${outputFile}`);
console.log(`Nombre de lignes : ${result.length}`);
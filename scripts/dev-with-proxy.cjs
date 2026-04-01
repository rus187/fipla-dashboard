const { spawn } = require("child_process");
const path = require("path");

const nodeCommand = process.execPath;
const viteBin = path.join(
  path.dirname(require.resolve("vite/package.json")),
  "bin",
  "vite.js"
);

const children = [];

function spawnProcess(command, args, name) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  children.push(child);

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${name} s'est arrêté avec le code ${code}.`);
      shutdown(code);
    }
  });

  child.on("error", (error) => {
    console.error(`Impossible de lancer ${name}:`, error);
    shutdown(1);
  });

  return child;
}

function shutdown(exitCode = 0) {
  while (children.length > 0) {
    const child = children.pop();
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
  }

  process.exit(exitCode);
}

spawnProcess(nodeCommand, ["src/server/taxwareProxy.js"], "le proxy TaxWare");
spawnProcess(nodeCommand, ["server/index.js"], "le backend Stripe");
spawnProcess(
  nodeCommand,
  [viteBin, "--host", "0.0.0.0", "--port", "4173"],
  "le serveur Vite"
);

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

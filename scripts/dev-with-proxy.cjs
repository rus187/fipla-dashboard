const { spawn, execFileSync } = require("child_process");
const path = require("path");

const nodeCommand = process.execPath;
const viteHost = "127.0.0.1";
const vitePort = "4173";
const viteBin = path.join(
  path.dirname(require.resolve("vite/package.json")),
  "bin",
  "vite.js"
);

const children = [];

function getListeningPidsOnPortWindows(port) {
  const output = execFileSync("netstat", ["-ano", "-p", "tcp"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  const pattern = new RegExp(`^\\s*TCP\\s+\\S+:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)\\s*$`, "i");

  return output
    .split(/\r?\n/)
    .map((line) => line.match(pattern))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .filter((pid, index, array) => Number.isFinite(pid) && array.indexOf(pid) === index);
}

function getProcessNameWindows(pid) {
  const output = execFileSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

  if (!output || output.startsWith("INFO:")) {
    return null;
  }

  const firstField = output.split(",")[0] || "";
  return firstField.replace(/^"|"$/g, "");
}

function killProcessTreeWindows(pid) {
  execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
    stdio: ["ignore", "ignore", "ignore"],
  });
}

function ensureVitePortAvailable() {
  if (process.platform !== "win32") {
    return;
  }

  const listeningPids = getListeningPidsOnPortWindows(vitePort);

  if (listeningPids.length === 0) {
    return;
  }

  const nonNodeOccupants = [];

  listeningPids.forEach((pid) => {
    const processName = getProcessNameWindows(pid);

    if (processName && processName.toLowerCase() === "node.exe") {
      console.log(`Ancien process Node détecté sur le port ${vitePort} (PID ${pid}), arrêt automatique.`);
      killProcessTreeWindows(pid);
      return;
    }

    nonNodeOccupants.push({ pid, processName });
  });

  const remainingPids = getListeningPidsOnPortWindows(vitePort);

  if (remainingPids.length > 0) {
    const details = nonNodeOccupants
      .map((occupant) => `${occupant.processName || "processus inconnu"} (PID ${occupant.pid})`)
      .join(", ");
    console.error(
      `Le port ${vitePort} est occupé par ${details || "un autre processus"}. Libère ce port puis relance npm run dev.`
    );
    process.exit(1);
  }
}

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

ensureVitePortAvailable();

spawnProcess(nodeCommand, ["src/server/taxwareProxy.js"], "le proxy TaxWare");
spawnProcess(nodeCommand, ["server/index.js"], "le backend Stripe");
console.log(`Démarrage du serveur Vite sur http://${viteHost}:${vitePort}`);
spawnProcess(
  nodeCommand,
  [viteBin, "--host", viteHost, "--port", vitePort, "--strictPort"],
  "le serveur Vite"
);

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

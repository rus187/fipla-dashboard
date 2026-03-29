import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import { pathToFileURL } from "url";

const DEFAULT_PROXY_PORT = 3001;
const DEFAULT_TAXWARE_PROXY_TIMEOUT_MS = 15000;

function readRequiredEnv(env, key, errorMessage) {
  const value = env[key]?.trim();

  if (!value) {
    throw new Error(errorMessage);
  }

  return value;
}

function parseTimeoutMs(env) {
  const timeoutSource = env.TAXWARE_PROXY_TIMEOUT_MS?.trim();

  if (!timeoutSource) {
    return DEFAULT_TAXWARE_PROXY_TIMEOUT_MS;
  }

  const timeoutMs = Number.parseInt(timeoutSource, 10);

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("TAXWARE_PROXY_TIMEOUT_MS doit être un entier strictement positif");
  }

  return timeoutMs;
}

export function resolveTaxwareProxyRuntimeConfig(env = process.env) {
  const apiUrl = readRequiredEnv(env, "TAXWARE_API_URL", "TAXWARE_API_URL manquante");
  const username = readRequiredEnv(
    env,
    "TAXWARE_USERNAME",
    "Identifiant TaxWare manquant"
  );
  const password = readRequiredEnv(
    env,
    "TAXWARE_PASSWORD",
    "Mot de passe TaxWare manquant"
  );

  try {
    new URL(apiUrl);
  } catch {
    throw new Error("TAXWARE_API_URL doit être une URL absolue valide");
  }

  return {
    apiUrl,
    timeoutMs: parseTimeoutMs(env),
    authorizationHeader:
      "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
  };
}

export function buildTaxwareProxyPreflight(env = process.env) {
  try {
    const runtimeConfig = resolveTaxwareProxyRuntimeConfig(env);
    const { host, pathname, protocol } = new URL(runtimeConfig.apiUrl);

    return {
      ready: true,
      apiTarget: `${protocol}//${host}${pathname}`,
      timeoutMs: runtimeConfig.timeoutMs,
      credentialsConfigured: true,
      issues: [],
    };
  } catch (error) {
    return {
      ready: false,
      apiTarget: null,
      timeoutMs: null,
      credentialsConfigured: Boolean(
        env.TAXWARE_USERNAME?.trim() && env.TAXWARE_PASSWORD?.trim()
      ),
      issues: [error instanceof Error ? error.message : "Configuration TaxWare invalide"],
    };
  }
}

function parseTaxwareJsonResponse(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("La réponse amont TaxWare n'est pas un JSON valide");
  }
}

function validateProxyPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Le proxy TaxWare attend un payload JSON objet non vide");
  }
}

export function createTaxwareProxyApp(env = process.env) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    const preflight = buildTaxwareProxyPreflight(env);

    res.status(preflight.ready ? 200 : 503).json({
      status: preflight.ready ? "ready" : "misconfigured",
      preflight,
    });
  });

  app.post("/api/taxware/simulate", async (req, res) => {
    try {
      validateProxyPayload(req.body);
    } catch (error) {
      return res.status(400).json({
        error: "taxware_proxy_invalid_payload",
        message: error instanceof Error ? error.message : "Payload proxy invalide",
      });
    }

    try {
      const payload = req.body;
      const runtimeConfig = resolveTaxwareProxyRuntimeConfig(env);
      const abortController = new AbortController();
      const timeoutHandle = setTimeout(
        () => abortController.abort(),
        runtimeConfig.timeoutMs
      );

      let response;

      try {
        response = await fetch(runtimeConfig.apiUrl, {
          method: "POST",
          headers: {
            Authorization: runtimeConfig.authorizationHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: abortController.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return res.status(504).json({
            error: "taxware_proxy_timeout",
            message: `Le service TaxWare n'a pas répondu dans le délai configuré (${runtimeConfig.timeoutMs} ms).`,
          });
        }

        return res.status(502).json({
          error: "taxware_proxy_network_error",
          message:
            error instanceof Error ? error.message : "Le proxy TaxWare n'a pas pu joindre l'amont.",
        });
      } finally {
        clearTimeout(timeoutHandle);
      }

      const text = await response.text();
      let data;

      try {
        data = parseTaxwareJsonResponse(text);
      } catch (error) {
        return res.status(502).json({
          error: "taxware_proxy_invalid_json",
          message:
            error instanceof Error
              ? error.message
              : "La réponse amont TaxWare n'est pas exploitable.",
        });
      }

      if (!response.ok) {
        return res.status(response.status).json({
          error: "taxware_upstream_error",
          details: data,
        });
      }

      return res.json(data);
    } catch (error) {
      return res.status(500).json({
        error: "taxware_proxy_misconfigured",
        message: error instanceof Error ? error.message : "Erreur serveur",
      });
    }
  });

  return app;
}

export function startTaxwareProxyServer(options = {}) {
  const { env = process.env, port = DEFAULT_PROXY_PORT } = options;
  const app = createTaxwareProxyApp(env);

  return app.listen(port, () => {
    console.log(`Serveur TaxWare lancé sur http://localhost:${port}`);
  });
}

const isDirectExecution =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectExecution) {
  dotenv.config({ path: "./src/server/.env" });
  startTaxwareProxyServer();
}

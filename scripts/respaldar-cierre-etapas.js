"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "respaldos");
const TABLES = [
  {
    name: "etapas_estado",
    query:
      "select=*&order=torneo_id.asc,tipo.asc,valor.asc,actualizado_en.asc"
  },
  {
    name: "respaldos_etapa",
    query: "select=*&order=torneo_id.asc,tipo.asc,valor.asc,version.asc"
  }
];

function readArgs(argv = process.argv.slice(2)) {
  const options = {
    outputDir: DEFAULT_OUTPUT_DIR
  };

  argv.forEach(arg => {
    if (arg.startsWith("--output-dir=")) {
      options.outputDir = path.resolve(ROOT, arg.slice("--output-dir=".length));
    }
  });

  return options;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta ${name}.`);
  }
  return value.replace(/\/+$/, "");
}

async function supabaseGet(url, serviceRoleKey, table) {
  const response = await fetch(`${url}/rest/v1/${table.name}?${table.query}`, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json"
    }
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `${table.name}: Supabase ${response.status} ${response.statusText}: ${text}`
    );
  }

  return text ? JSON.parse(text) : [];
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  return "{" + Object.keys(value)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",") + "}";
}

function sha256(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function writeBackup(data, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const payload = {
    formato: "tres-palos-respaldo-previo-cierre-etapas-v1",
    creado_en: new Date().toISOString(),
    alcance: ["etapas_estado", "respaldos_etapa"],
    nota:
      "Respaldo local previo a actualizar RPC de cierre por fecha/zona. Solo lectura.",
    counts: {
      etapas_estado: data.etapas_estado.length,
      respaldos_etapa: data.respaldos_etapa.length
    },
    data
  };
  payload.integridad = {
    algoritmo: "sha256",
    hash: sha256(payload.data)
  };

  const filePath = path.join(
    outputDir,
    `cierre-etapas-pre-fecha-zona-${timestamp()}.json`
  );
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

async function buildBackup(options = readArgs()) {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const data = {};

  for (const table of TABLES) {
    data[table.name] = await supabaseGet(supabaseUrl, serviceRoleKey, table);
  }

  return writeBackup(data, options.outputDir);
}

if (require.main === module) {
  buildBackup()
    .then(filePath => {
      console.log(`Respaldo local creado: ${filePath}`);
    })
    .catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  TABLES,
  readArgs,
  stableStringify,
  sha256,
  writeBackup,
  buildBackup
};

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "respaldos");
const REMOTE_HTTP_METHODS = ["GET"];

const TABLES = [
  {
    name: "torneos",
    query: "select=*&id=in.(1,2)&order=id.asc"
  },
  {
    name: "clubes",
    query: "select=*&order=id.asc"
  },
  {
    name: "jugadores",
    query: "select=*&order=id.asc"
  },
  {
    name: "jugadores_aliases",
    query: "select=*&order=jugador_id.asc,id.asc",
    optional: true
  },
  {
    name: "inscripciones_jugadores",
    query: "select=*&order=torneo_id.asc,club_id.asc,id.asc"
  },
  {
    name: "partidos",
    query: "select=*&torneo_id=in.(1,2)&order=torneo_id.asc,id.asc"
  },
  {
    name: "eventos_partido",
    query:
      "select=*,partidos!inner(torneo_id)&partidos.torneo_id=in.(1,2)&order=partido_id.asc,orden.asc,id.asc"
  },
  {
    name: "goleadores_oficiales",
    query: "select=*&torneo_id=in.(1,2)&order=torneo_id.asc,posicion.asc",
    optional: true
  }
];

function readArgs(argv = process.argv.slice(2)) {
  const options = {
    outputDir: DEFAULT_OUTPUT_DIR
  };

  argv.forEach(arg => {
    if (arg.startsWith("--output-dir=")) {
      options.outputDir = path.resolve(ROOT, arg.slice("--output-dir=".length));
      return;
    }
    throw new Error(`Argumento no reconocido: ${arg}`);
  });

  return options;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name}.`);
  return value.replace(/\/+$/, "");
}

function supabaseGet(config, table) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      new URL(`${config.url}/rest/v1/${table.name}?${table.query}`),
      {
        method: "GET",
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          Accept: "application/json"
        }
      },
      response => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", chunk => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode === 404 && table.optional) {
            resolve({ skipped: true, rows: [] });
            return;
          }
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(
              new Error(
                `${table.name}: Supabase ${response.statusCode} ` +
                  `${response.statusMessage}: ${body}`
              )
            );
            return;
          }
          resolve({ skipped: false, rows: body ? JSON.parse(body) : [] });
        });
      }
    );
    request.on("error", reject);
    request.end();
  });
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
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

function writeBackup(payload, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const filePath = path.join(
    outputDir,
    `identidad-jugadores-pre-aplicacion-${timestamp()}.json`
  );
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

async function buildBackup(options = readArgs()) {
  const config = {
    url: requiredEnv("SUPABASE_URL"),
    serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY")
  };
  const data = {};
  const skipped = [];

  for (const table of TABLES) {
    const result = await supabaseGet(config, table);
    data[table.name] = result.rows;
    if (result.skipped) skipped.push(table.name);
  }

  const counts = {};
  Object.keys(data).forEach(name => {
    counts[name] = data[name].length;
  });

  const payload = {
    formato: "tres-palos-identidad-jugadores-pre-aplicacion-v1",
    creado_en: new Date().toISOString(),
    metodo: "Supabase REST service role, solo GET",
    remote_http_methods: REMOTE_HTTP_METHODS,
    escrituras_supabase: 0,
    alcance: TABLES.map(table => table.name),
    omitidas_por_no_existir: skipped,
    counts,
    data
  };
  payload.integridad = {
    algoritmo: "sha256",
    hash: sha256(payload.data),
    hashes_por_tabla: Object.fromEntries(
      Object.entries(payload.data).map(([name, rows]) => [name, sha256(rows)])
    )
  };

  return writeBackup(payload, options.outputDir);
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
  REMOTE_HTTP_METHODS,
  readArgs,
  stableStringify,
  sha256,
  writeBackup,
  buildBackup
};

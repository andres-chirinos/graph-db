import { Client, Databases, Permission, Role, ID } from "appwrite";
import * as XLSX from "xlsx";

/**
 * Entrypoint para Appwrite Function
 * @param {Object} req - Appwrite function request
 * @param {Object} res - Appwrite function response
 */
export default async function main(req, res) {
  try {
    // Leer config y archivo
    const configJson = req.variables["config"] || req.payload?.config;
    const file = req.files?.file || req.payload?.file;
    if (!configJson || !file) {
      return res.json({ error: "Faltan datos" }, 400);
    }
    const config = typeof configJson === "string" ? JSON.parse(configJson) : configJson;

    // Inicializar Appwrite
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);
    const db = new Databases(client);
    const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
    const TABLES = {
      ENTITIES: "entities",
      CLAIMS: "claims",
      QUALIFIERS: "qualifiers",
      REFERENCES: "references",
    };

    // Parsear archivo
    const parsedRows = await parseImportFile(file, config);
    const claims = config.claims || [];
    const newEntityTemplate = config.newEntityTemplate || {};
    const results = [];
    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const rowValues = mapRowValues(row, config);
      // Procesar aliases
      let aliases = newEntityTemplate.aliases || "";
      aliases = aliases.replace(/{{\s*([\w-]+)\s*}}/g, (_, key) => rowValues[key] || "");
      aliases = aliases.split(/[\n,]+/).map(a => a.trim()).filter(Boolean);
      // Procesar label y description
      let label = newEntityTemplate.label || rowValues.label || `Entidad ${i + 1}`;
      label = label.replace(/{{\s*([\w-]+)\s*}}/g, (_, key) => rowValues[key] || "");
      let description = newEntityTemplate.description || rowValues.descripcion || "";
      description = description.replace(/{{\s*([\w-]+)\s*}}/g, (_, key) => rowValues[key] || "");
      // Crear entidad
      const entityRes = await db.createDocument(DATABASE_ID, TABLES.ENTITIES, ID.unique(), {
        label,
        description,
        aliases,
      });
      const entityId = entityRes?.$id;
      const createdClaims = [];
      if (entityId) {
        for (const claim of claims) {
          if (!claim.property) continue;
          let value = claim.valueExpr || "";
          value = value.replace(/{{\s*([\w-]+)\s*}}/g, (_, key) => rowValues[key] || "");
          const claimRes = await db.createDocument(DATABASE_ID, TABLES.CLAIMS, ID.unique(), {
            subject: entityId,
            property: claim.property,
            value_raw: value,
            datatype: claim.datatype || "string",
          });
          const claimId = claimRes?.$id;
          // Qualifiers
          if (claim.qualifiers && claim.qualifiers.length && claimId) {
            for (const qual of claim.qualifiers) {
              if (!qual.property) continue;
              let qValue = qual.valueExpr || "";
              qValue = qValue.replace(/{{\s*([\w-]+)\s*}}/g, (_, key) => rowValues[key] || "");
              await db.createDocument(DATABASE_ID, TABLES.QUALIFIERS, ID.unique(), {
                claim: claimId,
                property: qual.property,
                value_raw: qValue,
                datatype: qual.datatype || "string",
              });
            }
          }
          // References
          if (claim.references && claim.references.length && claimId) {
            for (const ref of claim.references) {
              if (!ref.property) continue;
              let rValue = ref.valueExpr || "";
              rValue = rValue.replace(/{{\s*([\w-]+)\s*}}/g, (_, key) => rowValues[key] || "");
              await db.createDocument(DATABASE_ID, TABLES.REFERENCES, ID.unique(), {
                claim: claimId,
                property: ref.property,
                value_raw: rValue,
                datatype: ref.datatype || "string",
              });
            }
          }
          createdClaims.push(claimRes);
        }
      }
      results.push({ entityId, label, aliases, claims: createdClaims });
    }
    return res.json({ ok: true, results });
  } catch (err) {
    return res.json({ error: err?.message || "Error en importación" }, 500);
  }
}

// Utilidades (puedes extraer de tu código actual)
function mapRowValues(row, config) {
  const output = {};
  const fields = Array.isArray(config.fields) ? config.fields : [];
  fields.forEach((field) => {
    if (!field?.name) return;
    const source = field.source;
    let value = null;
    if (source && row[source] !== undefined) {
      value = row[source];
    } else if (source) {
      const index = parseColumnLabel(source);
      if (index !== null && Array.isArray(row.__values)) {
        value = row.__values[index];
      }
    }
    output[field.name] = value ?? "";
  });
  return output;
}

function parseColumnLabel(source) {
  const match = /Columna\s+([A-Z]+)/i.exec(source || "");
  if (!match) return null;
  const letters = match[1].toUpperCase();
  let index = 0;
  for (let i = 0; i < letters.length; i += 1) {
    index *= 26;
    index += letters.charCodeAt(i) - 65 + 1;
  }
  return index - 1;
}

async function parseImportFile(file, config) {
  const format = config.format || "csv";
  const hasHeader = Boolean(config.hasHeader ?? true);
  if (format === "csv" || format === "tsv") {
    const separator = format === "tsv" ? "\t" : config.delimiter || ",";
    const text = file.buffer ? file.buffer.toString() : file.toString();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (!lines.length) return [];
    const headers = hasHeader
      ? parseDelimitedLine(lines[0], separator)
      : lines[0].split(separator).map((_, index) => `col_${index + 1}`);
    const rows = lines.slice(hasHeader ? 1 : 0).map((line) => parseDelimitedLine(line, separator));
    return rows.map((values) => {
      const row = { __values: values };
      headers.forEach((h, i) => (row[h] = values[i]));
      return row;
    });
  }
  if (format === "json") {
    const text = file.buffer ? file.buffer.toString() : file.toString();
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  }
  if (format === "xlsx") {
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: hasHeader ? 0 : 1 });
    return data;
  }
  return [];
}

function parseDelimitedLine(line, separator) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

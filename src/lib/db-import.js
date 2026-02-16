import * as XLSX from "xlsx";
import { tablesDB } from "./appwrite"; // Assuming tablesDB is also used for searching entities during import
import { DATABASE_ID, TABLES } from "./db-core";
import { searchEntities } from "./db-entities";

// ============================================
// IMPORTACIÓN
// ============================================

export async function runImportFromConfig(config, file) {
  return runImportFromConfigWithFile(config, file);
}

export async function runImportFromConfigWithFile(config, file) {
  if (!config || typeof config !== "object") {
    throw new Error("Configuración inválida para importación");
  }
  if (!file) {
    throw new Error("Debes seleccionar un archivo para importar");
  }

  const reconciliation = {
    mode: config.reconciliationMode ?? "manual",
    confidenceThreshold:
      typeof config.confidenceThreshold === "number" ? config.confidenceThreshold : 0.8,
    actions: {
      autoMergeHigh: config.reconciliationActions?.autoMergeHigh ?? true,
      autoCreateNoMatch: config.reconciliationActions?.autoCreateNoMatch ?? false,
      autoSkipLow: config.reconciliationActions?.autoSkipLow ?? false,
    },
    onMissingEntity: config.onMissingEntity ?? "create",
    basicSearch: {
      text: config.basicSearchText ?? "",
      fields: {
        label: config.basicSearchFields?.label ?? true,
        aliases: config.basicSearchFields?.aliases ?? true,
        description: config.basicSearchFields?.description ?? true,
      },
    },
    matchRules: Array.isArray(config.matchRules) ? config.matchRules : [],
  };

  const parsedRows = await parseImportFile(file, config);
  const limitedRows = parsedRows.slice(0, 25);
  const reconciliationItems = [];

  for (let index = 0; index < limitedRows.length; index += 1) {
    const row = limitedRows[index];
    const rowValues = mapRowValues(row, config);
    const searchTerm = buildSearchTerm(rowValues, config);
    let matchLabel = null;
    let confidence = 0.1;

    if (searchTerm) {
      try {
        // This searchEntities will need to come from db-entities.js
        const result = await searchEntities(searchTerm, 1, 0);
        const match = result?.rows?.[0];
        if (match) {
          matchLabel = `${match.$id} · ${match.label || "(Sin etiqueta)"}`;
          confidence = 0.85;
        }
      } catch (error) {
        console.warn("[Import] Error buscando entidad:", error);
      }
    }

    const suggested = matchLabel
      ? "merge"
      : reconciliation.onMissingEntity === "skip"
        ? "skip"
        : "create";

    reconciliationItems.push({
      id: `rec-${index}-${Date.now()}`,
      recordLabel: rowValues.label || rowValues.descripcion || searchTerm || `Registro ${index + 1}`,
      matchLabel,
      confidence,
      suggested,
    });
  }

  return {
    status: "configured",
    reconciliation,
    reconciliationItems,
    configSnapshot: config,
    createdAt: new Date().toISOString(),
  };
}

export function parseDelimitedLine(line, separator) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
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

export function indexToColumnName(index) {
  let value = "";
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    n = Math.floor((n - 1) / 26);
  }
  return `Columna ${value}`;
}

export function parseColumnLabel(source) {
  const match = /Columna\s+([A-Z]+)/i.exec(source || "");
  if (!match) return null;
  const letters = match[1].toUpperCase();
  let index = 0;
  for (let i = 0; i < letters.length; i += 1) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return index - 1;
}

export function mapRowValues(row, config) {
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

export function buildSearchTerm(rowValues, config) {
  const template = (config.basicSearchText || "").trim();
  if (template) {
    return template.replace(/{{\s*([\w-]+)\s*}}/g, (_, key) => rowValues[key] || "").trim();
  }
  return rowValues.label || rowValues.descripcion || "";
}

export async function parseImportFile(file, config) {
  const format = config.format || "csv";
  const hasHeader = Boolean(config.hasHeader ?? true);

  if (format === "csv" || format === "tsv") {
    const separator = format === "tsv" ? "	" : config.delimiter || ",";
    const text = await file.text();
const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (!lines.length) return [];
    const headers = hasHeader
      ? parseDelimitedLine(lines[0], separator)
      : lines[0].split(separator).map((_, index) => `col_${index + 1}`);
    const rows = lines.slice(hasHeader ? 1 : 0).map((line) => parseDelimitedLine(line, separator));
    return rows.map((values) => {
      const row = { __values: values };
      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });
      return row;
    });
  }

  if (format === "json") {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const data = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.data)
        ? parsed.data
        : Array.isArray(parsed?.items)
          ? parsed.items
          : [];
    if (!Array.isArray(data)) return [];
    if (data.length === 0) return [];

    if (Array.isArray(data[0])) {
      const headers = hasHeader
        ? data[0].map((value) => `${value}`)
        : data[0].map((_, index) => `col_${index + 1}`);
      const rows = data.slice(hasHeader ? 1 : 0);
      return rows.map((values) => {
        const row = { __values: values };
        headers.forEach((header, index) => {
          row[header] = values[index] ?? "";
        });
        return row;
      });
    }

    return data.map((item) => ({ ...item, __values: Object.values(item) }));
  }

  if (format === "xlsx") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    if (!rows.length) return [];
    const headers = hasHeader
      ? rows[0].map((value) => `${value}`)
      : rows[0].map((_, index) => `col_${index + 1}`);
    const dataRows = rows.slice(hasHeader ? 1 : 0);
    return dataRows.map((values) => {
      const row = { __values: values };
      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });
      return row;
    });
  }

  return [];
}

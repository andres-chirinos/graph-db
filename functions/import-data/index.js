import { Client, Databases, Permission, Role, ID } from "appwrite";
import * as XLSX from "xlsx";

/**
 * Entrypoint para Appwrite Function
 * @param {Object} req - Appwrite function request
 * @param {Object} res - Appwrite function response
 */
export default async function main(req, res) {
    try {
        // Usar solo req.files y req.variables, nunca parsear JSON del body
        context.log('req.files:', req.files);
        context.log('req.variables:', req.variables);

        const configRaw = req.variables?.config;
        const file = req.files?.file;

        if (!configRaw) {
            context.error('Missing config in req.variables');
            return res.json({ error: 'Missing config in req.variables' }, 400);
        }
        if (!file) {
            context.error('Missing file in req.files');
            return res.json({ error: 'Missing file in req.files' }, 400);
        }

        // Si configRaw es string, intentar parsear como JSON, pero solo si parece JSON
        let config = configRaw;
        if (typeof configRaw === 'string' && (configRaw.trim().startsWith('{') || configRaw.trim().startsWith('['))) {
            try {
                config = JSON.parse(configRaw);
            } catch (e) {
                context.error('Config is not valid JSON:', configRaw);
                return res.json({ error: 'Config is not valid JSON', details: configRaw }, 400);
            }
        }

        // ...aquí iría la lógica de importación usando config y file...
        context.log('Config and file received, ready to process.');
        return res.json({ ok: true, debug: { config, fileName: file.name } });
    } catch (err) {
        context.error('import-data main catch', err);
        return res.json({ error: err.message || err.toString() }, 500);
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

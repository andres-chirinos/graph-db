const sdk = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "master";

const COLLECTION_FIELDS = {
    entities: ['$id', 'label', 'description', 'aliases'],
    claims: ['$id', 'subject', 'property', 'datatype', 'value_raw', 'value_relation'],
    qualifiers: ['$id', 'claim', 'property', 'datatype', 'value_raw', 'value_relation'],
    references: ['$id', 'claim', 'reference', 'details'],
};

// ============================================
// PARSING UTILITIES
// ============================================

function parseDelimitedLine(line, separator) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];
        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i++;
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

function parseCsvString(csvString, config = {}) {
    const hasHeader = config.hasHeader !== false;
    const separator = config.delimiter || ",";
    const lines = csvString.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (!lines.length) return { headers: [], rows: [] };

    const headers = hasHeader
        ? parseDelimitedLine(lines[0], separator)
        : lines[0].split(separator).map((_, i) => `col_${i + 1}`);

    const dataLines = lines.slice(hasHeader ? 1 : 0);
    const rows = dataLines.map(line => {
        const values = parseDelimitedLine(line, separator);
        const row = {};
        headers.forEach((h, i) => {
            row[h] = values[i] ?? "";
        });
        return row;
    });

    return { headers, rows };
}

function parseJsonString(jsonString, dataPath) {
    const parsed = JSON.parse(jsonString);

    // If a dataPath is provided, use it to find the array
    let data;
    if (dataPath) {
        data = resolveDataPath(parsed, dataPath);
        if (!Array.isArray(data)) {
            throw new Error(`dataPath "${dataPath}" did not resolve to an array. Got: ${typeof data}`);
        }
    } else {
        // Auto-detect: try common keys
        data = Array.isArray(parsed) ? parsed
            : Array.isArray(parsed?.data) ? parsed.data
                : Array.isArray(parsed?.items) ? parsed.items
                    : Array.isArray(parsed?.rows) ? parsed.rows
                        : Array.isArray(parsed?.results) ? parsed.results
                            : Array.isArray(parsed?.records) ? parsed.records
                                : [];
    }

    if (!data.length) return { headers: [], rows: [] };

    if (Array.isArray(data[0])) {
        const headers = data[0].map(v => `${v}`);
        const rows = data.slice(1).map(values => {
            const row = {};
            headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
            return row;
        });
        return { headers, rows };
    }

    const headers = Object.keys(data[0]);
    return { headers, rows: data };
}

/**
 * Resolve a dot-notation path on an object.
 * Supports: "data.results", "response.items", "sheets[0].rows", "a.b.c"
 */
function resolveDataPath(obj, path) {
    if (!path || !obj) return obj;
    const segments = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let current = obj;
    for (const seg of segments) {
        if (current === null || current === undefined) return undefined;
        current = current[seg];
    }
    return current;
}

// ============================================
// ROW MAPPING
// ============================================

function mapRow(row, fields, targetCollection) {
    const doc = {};
    let customId = null;

    for (const mapping of fields) {
        const { source, target, defaultValue, transform } = mapping;
        let value = row[source] ?? defaultValue ?? "";

        // Handle $id separately — not part of document data
        if (target === "$id") {
            const idVal = String(value).trim();
            if (idVal) customId = idVal;
            continue;
        }

        // Apply basic transforms
        if (transform === "number") {
            value = Number(value) || 0;
        } else if (transform === "boolean") {
            value = value === "true" || value === "1" || value === true;
        } else if (transform === "json") {
            try { value = JSON.parse(value); } catch { /* keep as string */ }
        } else if (transform === "array") {
            value = String(value).split(/[|;]/).map(s => s.trim()).filter(Boolean);
        } else {
            value = String(value);
        }

        doc[target] = value;
    }

    // Set sensible defaults for entities
    if (targetCollection === "entities") {
        if (!doc.label) doc.label = "";
        if (!doc.description) doc.description = "";
        if (!doc.aliases) doc.aliases = [];
        if (typeof doc.aliases === "string") {
            doc.aliases = doc.aliases.split(/[|;]/).map(s => s.trim()).filter(Boolean);
        }
    }

    // Set sensible defaults for claims
    if (targetCollection === "claims") {
        if (!doc.datatype) doc.datatype = doc.value_relation ? "relation" : "string";
        if (doc.value_raw !== undefined && doc.value_raw !== null && typeof doc.value_raw !== "string") {
            doc.value_raw = JSON.stringify(doc.value_raw);
        }
    }

    return { data: doc, customId };
}

// ============================================
// IMPORT ENGINE
// ============================================

async function importRows(databases, config, rows, log) {
    const targetCollection = config.targetCollection || "entities";
    const fields = config.fields || [];
    const useBatch = config.useBatch === true;
    const batchSize = config.batchSize || 50;

    const results = {
        total: rows.length,
        created: 0,
        errors: [],
        documents: [],
    };

    if (useBatch) {
        // Batch mode: concurrent inserts in chunks using Promise.allSettled
        for (let i = 0; i < rows.length; i += batchSize) {
            const chunk = rows.slice(i, i + batchSize);
            const promises = chunk.map((row, idx) => {
                try {
                    const { data, customId } = mapRow(row, fields, targetCollection);
                    const docId = customId || sdk.ID.unique();
                    return databases.createDocument(
                        DATABASE_ID,
                        targetCollection,
                        docId,
                        data
                    ).then(doc => ({
                        success: true,
                        rowIndex: i + idx,
                        $id: doc.$id,
                        data,
                        sourceRow: row,
                    }));
                } catch (err) {
                    return Promise.resolve({ success: false, rowIndex: i + idx, error: err.message });
                }
            });

            const settled = await Promise.allSettled(promises);

            for (const result of settled) {
                if (result.status === 'fulfilled' && result.value.success) {
                    results.created++;
                    results.documents.push({
                        $id: result.value.$id,
                        ...result.value.data,
                        _sourceRow: result.value.sourceRow,
                    });
                } else {
                    const err = result.status === 'rejected'
                        ? result.reason?.message || String(result.reason)
                        : result.value?.error || 'Unknown error';
                    const rowIdx = result.status === 'fulfilled' ? result.value.rowIndex : -1;
                    results.errors.push({
                        row: rowIdx + 1,
                        error: err,
                    });
                }
            }

            log(`Batch ${Math.floor(i / batchSize) + 1}: processed ${chunk.length} rows`);
        }
    } else {
        // Row-by-row mode (sequential)
        for (let i = 0; i < rows.length; i++) {
            try {
                const { data, customId } = mapRow(rows[i], fields, targetCollection);
                const docId = customId || sdk.ID.unique();

                const doc = await databases.createDocument(
                    DATABASE_ID,
                    targetCollection,
                    docId,
                    data
                );

                results.created++;
                results.documents.push({
                    $id: doc.$id,
                    ...data,
                    _sourceRow: rows[i],
                });

                if ((i + 1) % 50 === 0) {
                    log(`Progress: ${i + 1}/${rows.length} rows processed`);
                }
            } catch (err) {
                results.errors.push({
                    row: i + 1,
                    error: err.message,
                    data: rows[i],
                });
            }
        }
    }

    return results;
}

// ============================================
// MAIN HANDLER
// ============================================

module.exports = async ({ req, res, log, error }) => {
    try {
        // ------- GET: Redirect to web app -------
        if (req.method === 'GET') {
            return res.json({
                message: 'Import Data API — use POST to import. UI available at /import in the web application.',
                collections: Object.keys(COLLECTION_FIELDS),
                fields: COLLECTION_FIELDS,
            }, 200);
        }

        // ------- POST: Process Import -------
        if (req.method === 'POST') {
            let body = req.body;
            if (typeof body === 'string') {
                body = JSON.parse(body);
            }

            if (!body) {
                return res.json({ error: 'Request body is required' }, 400);
            }

            const {
                targetCollection = "entities",
                format = "csv",
                hasHeader = true,
                delimiter = ",",
                dataPath = "",
                skipRows = 0,
                fields = [],
                csvData,
                jsonData,
                rows: preRows,
                useBatch = false,
                batchSize = 50,
            } = body;

            // Validate required fields
            if (!fields || !Array.isArray(fields) || fields.length === 0) {
                return res.json({
                    error: 'Field mappings are required',
                    example: {
                        fields: [
                            { source: "Column Name", target: "label" },
                            { source: "Description Column", target: "description" },
                        ]
                    }
                }, 400);
            }

            // Validate target collection
            const validCollections = Object.keys(COLLECTION_FIELDS);
            if (!validCollections.includes(targetCollection)) {
                return res.json({
                    error: `Invalid targetCollection. Must be one of: ${validCollections.join(', ')}`,
                }, 400);
            }

            // Validate target fields
            const validTargets = COLLECTION_FIELDS[targetCollection];
            const invalidFields = fields.filter(f => !validTargets.includes(f.target));
            if (invalidFields.length > 0) {
                return res.json({
                    error: `Invalid target fields for collection "${targetCollection}": ${invalidFields.map(f => f.target).join(', ')}`,
                    validFields: validTargets,
                }, 400);
            }

            // Parse data
            let parsedRows = [];
            let parsedHeaders = [];

            if (preRows && Array.isArray(preRows)) {
                parsedRows = preRows;
                parsedHeaders = preRows.length > 0 ? Object.keys(preRows[0]) : [];
            } else if (csvData) {
                const result = parseCsvString(csvData, { hasHeader, delimiter });
                // Apply skipRows: skip N data rows after header
                parsedRows = skipRows > 0 ? result.rows.slice(skipRows) : result.rows;
                parsedHeaders = result.headers;
            } else if (jsonData) {
                const dataStr = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);
                const result = parseJsonString(dataStr, dataPath || undefined);
                parsedRows = skipRows > 0 ? result.rows.slice(skipRows) : result.rows;
                parsedHeaders = result.headers;
            } else {
                return res.json({
                    error: 'No data provided. Send "csvData" (string), "jsonData", or "rows" (array).',
                }, 400);
            }

            if (parsedRows.length === 0) {
                return res.json({
                    error: 'No rows found in the provided data.',
                    headers: parsedHeaders,
                }, 400);
            }

            log(`Importing ${parsedRows.length} rows into "${targetCollection}"`);

            // Initialize Appwrite client
            const endpoint = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
            const projectId = process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
            const apiKey = req.headers['x-appwrite-key'] || process.env.APPWRITE_API_KEY;
            const userJwt = req?.headers?.["x-appwrite-user-jwt"];

            if (!endpoint || !projectId) {
                return res.json({ error: 'Missing APPWRITE_ENDPOINT or APPWRITE_PROJECT_ID' }, 500);
            }

            const client = new sdk.Client()
                .setEndpoint(endpoint)
                .setProject(projectId);

            if (userJwt) {
                client.setJWT(userJwt);
            } else if (apiKey) {
                client.setKey(apiKey);
            } else {
                log("Warning: No API Key. Operations may fail due to permissions.");
            }

            const databases = new sdk.Databases(client);

            // Execute import
            const importResult = await importRows(databases, {
                targetCollection,
                fields,
                useBatch,
                batchSize,
            }, parsedRows, log);

            log(`Import complete: ${importResult.created}/${importResult.total} created, ${importResult.errors.length} errors`);

            return res.json({
                success: true,
                total: importResult.total,
                created: importResult.created,
                documents: importResult.documents,
                errors: importResult.errors.slice(0, 50),
                hasMoreErrors: importResult.errors.length > 50,
            }, 200);
        }

        return res.json({ error: 'Method not allowed. Use POST to import data.' }, 405);
    } catch (err) {
        error(err.message || err.toString());
        return res.json({ error: err.message || 'Internal Server Error' }, 500);
    }
};

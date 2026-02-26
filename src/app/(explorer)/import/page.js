"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { executeFunction, FUNCTIONS } from "@/lib/functions";
import { LoadingState } from "@/components";
import EntitySelector from "@/components/EntitySelector";
import "./style.css";

const FUNCTION_ID = FUNCTIONS.IMPORT;

const COLLECTION_FIELDS = {
    entities: ["$id", "label", "description", "aliases"],
    claims: ["$id", "subject", "property", "datatype", "value_raw", "value_relation"],
    qualifiers: ["$id", "claim", "property", "datatype", "value_raw", "value_relation"],
    references: ["$id", "claim", "reference", "details"],
};

const TRANSFORMS = ["string", "number", "boolean", "json", "array"];

const SYNONYMS = {
    id: "$id", identifier: "$id", document_id: "$id", doc_id: "$id",
    nombre: "label", name: "label", etiqueta: "label", titulo: "label", title: "label",
    descripcion: "description", desc: "description",
    alias: "aliases", sinónimos: "aliases", synonyms: "aliases",
    sujeto: "subject", propiedad: "property", valor: "value_raw", value: "value_raw",
    tipo: "datatype", type: "datatype", referencia: "reference", ref: "reference",
    detalles: "details", detail: "details",
};

// ============================================
// CSV Parsing (client-side)
// ============================================

function parseDelimitedLine(line, sep) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (c === sep && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += c;
        }
    }
    result.push(current.trim());
    return result;
}

function parseCsvText(text, separator = ",") {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return { headers: [], rows: [] };

    const headers = parseDelimitedLine(lines[0], separator);
    const rows = lines.slice(1).map(line => {
        const values = parseDelimitedLine(line, separator);
        const row = {};
        headers.forEach((h, i) => { row[h] = values[i] || ""; });
        return row;
    });
    return { headers, rows };
}

function parseJsonText(text, dataPath) {
    const parsed = JSON.parse(text);

    let data;
    if (dataPath) {
        data = resolveDataPath(parsed, dataPath);
        if (!Array.isArray(data)) {
            throw new Error(`La ruta "${dataPath}" no contiene un array.`);
        }
    } else {
        // Auto-detect common keys
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
        const headers = data[0].map(v => String(v));
        const rows = data.slice(1).map(values => {
            const row = {};
            headers.forEach((h, i) => { row[h] = values[i] || ""; });
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

/**
 * Recursively detect all paths in a JSON structure that lead to arrays of objects.
 * Returns array of { path, length, sample } objects.
 */
function detectJsonPaths(obj, prefix = "", maxDepth = 5) {
    const results = [];
    if (maxDepth <= 0 || !obj || typeof obj !== "object") return results;

    if (Array.isArray(obj)) {
        if (obj.length > 0 && typeof obj[0] === "object" && !Array.isArray(obj[0])) {
            const keys = Object.keys(obj[0]).slice(0, 5).join(", ");
            results.push({
                path: prefix || "(raíz)",
                length: obj.length,
                sample: keys,
                isRoot: !prefix,
            });
        }
        // Also check nested arrays in first element
        if (obj.length > 0 && typeof obj[0] === "object") {
            for (const [key, val] of Object.entries(obj[0])) {
                if (Array.isArray(val) || (typeof val === "object" && val !== null)) {
                    const childPath = prefix ? `${prefix}[0].${key}` : `[0].${key}`;
                    results.push(...detectJsonPaths(val, childPath, maxDepth - 1));
                }
            }
        }
        return results;
    }

    // It's a plain object — check each key
    for (const [key, val] of Object.entries(obj)) {
        if (val === null || val === undefined) continue;
        const childPath = prefix ? `${prefix}.${key}` : key;

        if (Array.isArray(val)) {
            results.push(...detectJsonPaths(val, childPath, maxDepth - 1));
        } else if (typeof val === "object") {
            results.push(...detectJsonPaths(val, childPath, maxDepth - 1));
        }
    }

    return results;
}

function autoMapField(header, targetFields) {
    const h = header.toLowerCase().trim();
    for (const f of targetFields) {
        if (h === f || h.includes(f) || f.includes(h)) return f;
    }
    if (SYNONYMS[h] && targetFields.includes(SYNONYMS[h])) return SYNONYMS[h];
    return "";
}

function autoTransform(target) {
    if (target === "aliases") return "array";
    return "string";
}

// ============================================
// Formula Helpers (mirrors server-side FORMULA_HELPERS)
// ============================================

const FORMULA_HELPERS = {
    TRIM: (v) => String(v ?? "").trim(),
    UPPER: (v) => String(v ?? "").toUpperCase(),
    LOWER: (v) => String(v ?? "").toLowerCase(),
    CAPITALIZE: (v) => String(v ?? "").replace(/\b\w/g, c => c.toUpperCase()),
    REPLACE: (v, search, rep) => String(v ?? "").replaceAll(search, rep ?? ""),
    PREFIX: (v, pre) => String(pre ?? "") + String(v ?? ""),
    SUFFIX: (v, suf) => String(v ?? "") + String(suf ?? ""),
    PAD: (v, len, ch) => String(v ?? "").padStart(Number(len) || 2, ch || "0"),
    CONCAT: (...args) => args.map(a => String(a ?? "")).join(""),
    LEN: (v) => String(v ?? "").length,
    LEFT: (v, n) => String(v ?? "").substring(0, Number(n) || 1),
    RIGHT: (v, n) => { const s = String(v ?? ""); return s.substring(s.length - (Number(n) || 1)); },
    SUBSTR: (v, start, len) => { const s = String(v ?? ""); return s.substring(Number(start) || 0, len != null ? (Number(start) || 0) + Number(len) : s.length); },
    SPLIT: (v, sep, idx) => { const parts = String(v ?? "").split(sep ?? ","); return parts[Number(idx) || 0] ?? ""; },
    REGEX: (v, pattern) => { try { const m = String(v ?? "").match(new RegExp(pattern)); return m ? (m[1] || m[0]) : ""; } catch { return ""; } },
    CLEAN: (v) => String(v ?? "").replace(/[^\w\s]/g, "").trim(),
    NUM: (v) => { const n = Number(String(v ?? "").replace(/[^\d.\-]/g, "")); return isNaN(n) ? 0 : n; },
    ROUND: (v, d) => { const n = Number(v); return isNaN(n) ? v : Number(n.toFixed(Number(d) || 0)); },
    ABS: (v) => Math.abs(Number(v) || 0),
    FLOOR: (v) => Math.floor(Number(v) || 0),
    CEIL: (v) => Math.ceil(Number(v) || 0),
    MIN: (...args) => Math.min(...args.map(Number)),
    MAX: (...args) => Math.max(...args.map(Number)),
    IF: (cond, then_val, else_val) => cond ? then_val : (else_val ?? ""),
    TODAY: () => new Date().toISOString().split("T")[0],
    YEAR: (v) => { try { return new Date(v).getFullYear(); } catch { return ""; } },
};

const _helperNames = Object.keys(FORMULA_HELPERS);
const _helperValues = Object.values(FORMULA_HELPERS);

/** Evaluate a formula expression client-side (mirrors server evalFormula) */
function evalFormulaLocal(expression, value, row, index) {
    try {
        const fn = new Function("value", "row", "index", ..._helperNames, `return (${expression})`);
        return fn(value, row, index, ..._helperValues);
    } catch (e) {
        return `#ERR: ${e.message}`;
    }
}

/** Apply formulas client-side for preview (real processing on server) */
function applyFormulasLocal(rows, headers, formulas) {
    if (!formulas.length) return { rows, headers };
    let newHeaders = [...headers];
    let newRows = rows.map(r => ({ ...r }));
    for (const f of formulas) {
        if (!f.expression) continue;
        if (f.isNew) {
            if (!newHeaders.includes(f.target)) newHeaders.push(f.target);
            newRows = newRows.map((row, idx) => ({ ...row, [f.target]: evalFormulaLocal(f.expression, "", row, idx) }));
        } else if (f.target === "__all__") {
            newRows = newRows.map((row, idx) => {
                const u = { ...row };
                for (const col of newHeaders) u[col] = evalFormulaLocal(f.expression, u[col], u, idx);
                return u;
            });
        } else {
            newRows = newRows.map((row, idx) => ({ ...row, [f.target]: evalFormulaLocal(f.expression, row[f.target], row, idx) }));
        }
    }
    return { rows: newRows, headers: newHeaders };
}

/** Available function names for autocomplete hints */
const FORMULA_FUNCTION_LIST = _helperNames.join(", ");

// ============================================
// Download helpers
// ============================================

function csvEscape(val) {
    const str = val === null || val === undefined ? "" : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function triggerDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType + ";charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// Component
// ============================================

export default function ImportPage() {
    const { authLoading } = useAuth();
    const fileInputRef = useRef(null);

    const [activeTab, setActiveTab] = useState("import");
    const [fileHeaders, setFileHeaders] = useState([]);
    const [allRows, setAllRows] = useState([]);
    const [previewRows, setPreviewRows] = useState([]);
    const [fileName, setFileName] = useState("");
    const [dragover, setDragover] = useState(false);
    const [fileFormat, setFileFormat] = useState(""); // "csv", "tsv", "json"
    const [rawFileText, setRawFileText] = useState(""); // raw JSON text for re-parsing

    // Config
    const [targetCollection, setTargetCollection] = useState("entities");
    const [insertMode, setInsertMode] = useState("single");

    // Data path (JSON)
    const [dataPath, setDataPath] = useState("");
    const [detectedPaths, setDetectedPaths] = useState([]);

    // Mapping
    const [mappings, setMappings] = useState([]);

    // Import state
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState("");
    const [result, setResult] = useState(null);

    const showConfig = fileHeaders.length > 0;

    // Import mode: "flat" (single collection) or "schema" (entities+claims+qualifiers+refs)
    const [importMode, setImportMode] = useState("flat");

    // Formulas (unified: transforms + computed columns)
    const [formulas, setFormulas] = useState([]);
    const [formulaPreview, setFormulaPreview] = useState(null);

    // Schema builder state
    const [schema, setSchema] = useState({
        entities: {},
        match: {},
        claims: {},
        qualifiers: {},
        references: {},
    });
    const [schemaCounters, setSchemaCounters] = useState({ entity: 0, claim: 0, qual: 0, ref: 0 });
    const [schemaJsonText, setSchemaJsonText] = useState("{}");
    const schemaFileRef = useRef(null);
    const [entityPickerOpen, setEntityPickerOpen] = useState(null); // "claims.claim-0.property"

    // Sync JSON text when schema changes from UI
    useEffect(() => {
        setSchemaJsonText(JSON.stringify(schema, null, 2));
    }, [schema]);

    // Helper: render an expression input with an entity picker button
    const EntityPickerField = ({ fieldKey, value, onChange, placeholder, label: fieldLabel }) => {
        const isOpen = entityPickerOpen === fieldKey;
        return (
            <div className="schema-field-row">
                <label>{fieldLabel}</label>
                <input type="text" className="transform-input transform-expression"
                    value={value || ""}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder} />
                <button
                    type="button"
                    className="schema-picker-btn"
                    title="Buscar entidad"
                    onClick={() => setEntityPickerOpen(isOpen ? null : fieldKey)}
                >
                    🔍
                </button>
                {isOpen && (
                    <div className="schema-picker-popup">
                        <EntitySelector
                            value={null}
                            placeholder="Buscar entidad..."
                            onChange={(id) => {
                                if (id) onChange(`'${id}'`);
                                setEntityPickerOpen(null);
                            }}
                        />
                    </div>
                )}
            </div>
        );
    };

    // === File Handling ===
    const handleFile = useCallback((file) => {
        setFileName(`📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
        setResult(null);
        setDetectedPaths([]);
        setDataPath("");
        setRawFileText("");

        const ext = file.name.split(".").pop().toLowerCase();
        setFileFormat(ext === "tsv" ? "tsv" : ext);

        if (ext === "csv" || ext === "tsv") {
            const reader = new FileReader();
            reader.onload = (e) => {
                const { headers, rows } = parseCsvText(e.target.result, ext === "tsv" ? "\t" : ",");
                applyParsedData(headers, rows);
            };
            reader.readAsText(file);
        } else if (ext === "json") {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    setRawFileText(text);

                    // Detect all array paths in the JSON
                    const parsed = JSON.parse(text);
                    const paths = detectJsonPaths(parsed);
                    setDetectedPaths(paths);

                    // Auto-select: if root is array, use it; otherwise pick first detected path
                    const rootPath = paths.find(p => p.isRoot);
                    const bestPath = rootPath ? "" : (paths.length > 0 ? paths[0].path : "");
                    setDataPath(bestPath);

                    // Parse with the detected path
                    const { headers, rows } = parseJsonText(text, bestPath || undefined);
                    applyParsedData(headers, rows);
                } catch (err) {
                    alert("Error parseando JSON: " + err.message);
                }
            };
            reader.readAsText(file);
        } else {
            alert("Formato no soportado. Usa CSV, TSV o JSON.");
        }
    }, [targetCollection]);

    function applyParsedData(headers, rows) {
        setFileHeaders(headers);
        setAllRows(rows);
        setPreviewRows(rows.slice(0, 10));

        // Auto-map fields
        const targetFields = COLLECTION_FIELDS[targetCollection] || [];
        const newMappings = headers.map(h => ({
            source: h,
            target: autoMapField(h, targetFields),
            transform: autoTransform(autoMapField(h, targetFields)),
        }));
        setMappings(newMappings);
    }

    /** Re-parse JSON with a new data path */
    function handleDataPathChange(newPath) {
        setDataPath(newPath);
        if (!rawFileText) return;
        try {
            const pathArg = newPath === "(raíz)" ? undefined : (newPath || undefined);
            const { headers, rows } = parseJsonText(rawFileText, pathArg);
            applyParsedData(headers, rows);
        } catch (err) {
            alert(`Error con la ruta "${newPath}": ${err.message}`);
        }
    }

    function updateMappingTarget(idx, value) {
        setMappings(prev => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], target: value, transform: autoTransform(value) };
            return updated;
        });
    }

    function updateMappingTransform(idx, value) {
        setMappings(prev => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], transform: value };
            return updated;
        });
    }

    function handleCollectionChange(value) {
        setTargetCollection(value);
        const targetFields = COLLECTION_FIELDS[value] || [];
        setMappings(prev => prev.map(m => ({
            ...m,
            target: autoMapField(m.source, targetFields),
            transform: autoTransform(autoMapField(m.source, targetFields)),
        })));
    }

    // === Schema Builder CRUD ===
    function addSchemaItem(section, prefix, defaults) {
        const key = `${prefix}-${schemaCounters[prefix]}`;
        setSchemaCounters(prev => ({ ...prev, [prefix]: prev[prefix] + 1 }));
        setSchema(prev => ({
            ...prev,
            [section]: { ...prev[section], [key]: { ...defaults } }
        }));
    }

    function updateSchemaItem(section, key, updates) {
        setSchema(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: { ...prev[section][key], ...updates }
            }
        }));
    }

    function removeSchemaItem(section, key) {
        setSchema(prev => {
            const copy = { ...prev[section] };
            delete copy[key];
            // Also remove match rule if entity is removed
            if (section === "entities") {
                const matchCopy = { ...prev.match };
                delete matchCopy[key];
                return { ...prev, [section]: copy, match: matchCopy };
            }
            return { ...prev, [section]: copy };
        });
    }

    function updateMatchRule(entityKey, updates) {
        setSchema(prev => ({
            ...prev,
            match: {
                ...prev.match,
                [entityKey]: { ...prev.match[entityKey], ...updates }
            }
        }));
    }

    function removeMatchRule(entityKey) {
        setSchema(prev => {
            const copy = { ...prev.match };
            delete copy[entityKey];
            return { ...prev, match: copy };
        });
    }

    // Symbol ID options for dropdowns
    const entitySymbolIds = Object.keys(schema.entities);
    const claimSymbolIds = Object.keys(schema.claims);

    // === Formulas ===
    function addFormula(isNew = false) {
        setFormulas(prev => [
            ...prev,
            {
                target: isNew ? "" : (fileHeaders[0] || ""),
                expression: "",
                isNew,
                id: Date.now(),
            },
        ]);
    }

    function updateFormula(idx, updates) {
        setFormulas(prev => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], ...updates };
            return updated;
        });
    }

    function removeFormula(idx) {
        setFormulas(prev => prev.filter((_, i) => i !== idx));
        setFormulaPreview(null);
    }

    function previewFormulas() {
        const { rows: transformed, headers: newHeaders } = applyFormulasLocal(allRows, fileHeaders, formulas);
        setFormulaPreview({
            headers: newHeaders,
            rows: transformed,
            preview: transformed.slice(0, 10),
        });
        // Add new columns to mappings
        const targetFields = COLLECTION_FIELDS[targetCollection] || [];
        const currentSources = mappings.map(m => m.source);
        const newCols = newHeaders.filter(h => !currentSources.includes(h));
        if (newCols.length > 0) {
            setMappings(prev => [
                ...prev,
                ...newCols.map(h => ({
                    source: h,
                    target: autoMapField(h, targetFields),
                    transform: autoTransform(autoMapField(h, targetFields)),
                })),
            ]);
            setFileHeaders(newHeaders);
        }
    }

    function getFormulaSample(f) {
        if (!previewRows.length || !f.expression) return "";
        const row = previewRows[0];
        const val = f.isNew ? "" : (f.target === "__all__" ? row[fileHeaders[0]] : row[f.target]);
        return String(evalFormulaLocal(f.expression, val, row, 0));
    }

    // === Import ===
    async function runImport() {
        setImporting(true);
        setProgress(10);
        setProgressText(`Enviando ${allRows.length} filas...`);
        setResult(null);

        try {
            // Build formulas array for server
            const serverFormulas = formulas
                .filter(f => f.expression)
                .map(f => ({
                    target: f.target,
                    expression: f.expression,
                    isNew: f.isNew || false,
                }));

            let payload;

            if (importMode === "schema") {
                // Validate schema has at least one entity
                if (Object.keys(schema.entities).length === 0) {
                    alert("Define al menos una entidad en el esquema.");
                    setImporting(false);
                    return;
                }

                payload = {
                    mode: "schema",
                    rows: allRows,
                    formulas: serverFormulas,
                    schema: schema,
                };
            } else {
                // Flat mode
                const fields = mappings.filter(m => m.target);
                if (fields.length === 0) {
                    alert("Debes mapear al menos un campo.");
                    setImporting(false);
                    return;
                }

                payload = {
                    mode: "flat",
                    targetCollection,
                    rows: allRows,
                    formulas: serverFormulas,
                    fields: fields.map(f => ({ source: f.source, target: f.target, transform: f.transform })),
                    useBatch: insertMode === "batch",
                    batchSize: 50,
                };
            }

            setProgress(30);
            setProgressText("Procesando importación en el servidor...");

            const execution = await executeFunction(FUNCTION_ID, payload);

            setProgress(100);
            setResult(execution);
        } catch (err) {
            setResult({ success: false, error: err.message, total: allRows.length, created: 0, errors: [] });
        } finally {
            setImporting(false);
        }
    }

    // === Downloads ===
    function downloadCsv() {
        if (!result?.documents?.length) return;
        const docs = result.documents;
        const keys = Object.keys(docs[0]).filter(k => k !== "_sourceRow");
        const header = keys.map(csvEscape).join(",");
        const rows = docs.map(doc =>
            keys.map(k => {
                const val = doc[k];
                return csvEscape(Array.isArray(val) ? val.join("|") : val);
            }).join(",")
        );
        triggerDownload([header, ...rows].join("\n"), `${targetCollection}_imported.csv`, "text/csv");
    }

    function downloadJson() {
        if (!result?.documents?.length) return;
        const docs = result.documents.map(doc => {
            const clean = {};
            for (const [k, v] of Object.entries(doc)) {
                if (k !== "_sourceRow") clean[k] = v;
            }
            return clean;
        });
        triggerDownload(JSON.stringify(docs, null, 2), `${targetCollection}_imported.json`, "application/json");
    }

    // === Render ===
    if (authLoading) {
        return (
            <div className="explorer-layout">
                <main className="explorer-main">
                    <div className="explorer-container">
                        <LoadingState message="Cargando..." />
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="explorer-layout">
            <main className="explorer-main">
                <div className="explorer-container">

                    <header className="import-header">
                        <h1>📥 Importar datos</h1>
                        <p>Importar datos masivos desde CSV o JSON a la base de conocimiento</p>
                    </header>

                    {/* Tabs */}
                    <div className="import-tabs">
                        <button
                            className={`import-tab ${activeTab === "import" ? "active" : ""}`}
                            onClick={() => setActiveTab("import")}
                        >
                            📤 Importar
                        </button>
                        <button
                            className={`import-tab ${activeTab === "docs" ? "active" : ""}`}
                            onClick={() => setActiveTab("docs")}
                        >
                            📖 API Docs
                        </button>
                    </div>

                    {/* =========== IMPORT TAB =========== */}
                    <div className={`import-panel ${activeTab === "import" ? "active" : ""}`}>

                        {/* Upload Zone */}
                        <div
                            className={`upload-zone ${dragover ? "dragover" : ""}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
                            onDragLeave={() => setDragover(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragover(false);
                                if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
                            }}
                        >
                            <div className="upload-zone-icon">📁</div>
                            <p>Arrastra un archivo aquí o haz clic para seleccionar</p>
                            <p className="upload-zone-formats">CSV, TSV, JSON</p>
                            {fileName && <div className="upload-zone-filename">{fileName}</div>}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.json,.tsv"
                            style={{ display: "none" }}
                            onChange={(e) => e.target.files.length > 0 && handleFile(e.target.files[0])}
                        />

                        {/* JSON Data Path Selector */}
                        {showConfig && fileFormat === "json" && detectedPaths.length > 0 && (
                            <div className="import-section">
                                <h3>📍 Ruta de datos</h3>
                                <p style={{ color: "#72777d", fontSize: "0.8125rem", marginBottom: "0.75rem" }}>
                                    Se detectaron {detectedPaths.length} ubicación(es) de datos en el JSON.
                                    Selecciona cuál contiene los registros a importar.
                                </p>
                                <div className="config-row">
                                    <div className="config-field" style={{ flex: 1 }}>
                                        <label>Ruta detectada</label>
                                        <select
                                            value={dataPath}
                                            onChange={(e) => handleDataPathChange(e.target.value)}
                                        >
                                            {detectedPaths.map((p, i) => (
                                                <option key={i} value={p.path}>
                                                    {p.path} — {p.length} elementos ({p.sample})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="config-field" style={{ flex: 1 }}>
                                        <label>Ruta personalizada (dot notation)</label>
                                        <input
                                            type="text"
                                            value={dataPath === "(raíz)" ? "" : dataPath}
                                            onChange={(e) => handleDataPathChange(e.target.value)}
                                            placeholder="ej: data.results, response.items"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Import Mode Toggle */}
                        {showConfig && (
                            <div className="import-section">
                                <h3>📦 Modo de importación</h3>
                                <div className="schema-mode-toggle">
                                    <button
                                        className={`schema-mode-btn ${importMode === "flat" ? "active" : ""}`}
                                        onClick={() => setImportMode("flat")}
                                    >
                                        <strong>📋 Plano</strong>
                                        <span>Importar filas a una colección</span>
                                    </button>
                                    <button
                                        className={`schema-mode-btn ${importMode === "schema" ? "active" : ""}`}
                                        onClick={() => setImportMode("schema")}
                                    >
                                        <strong>🧩 Esquema</strong>
                                        <span>Crear entidades + claims + qualifiers + refs</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Config (flat mode only) */}
                        {showConfig && importMode === "flat" && (
                            <div className="import-section">
                                <h3>⚙️ Configuración</h3>
                                <div className="config-row">
                                    <div className="config-field">
                                        <label>Colección destino</label>
                                        <select value={targetCollection} onChange={(e) => handleCollectionChange(e.target.value)}>
                                            <option value="entities">Entities (Entidades)</option>
                                            <option value="claims">Claims (Declaraciones)</option>
                                            <option value="qualifiers">Qualifiers (Calificadores)</option>
                                            <option value="references">References (Referencias)</option>
                                        </select>
                                    </div>
                                    <div className="config-field">
                                        <label>Modo de inserción</label>
                                        <select value={insertMode} onChange={(e) => setInsertMode(e.target.value)}>
                                            <option value="single">Fila por fila</option>
                                            <option value="batch">Batch (lotes)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Preview */}
                        {showConfig && (
                            <div className="import-section">
                                <h3>
                                    📋 Vista previa{" "}
                                    <span className="preview-row-count">
                                        ({allRows.length} filas totales, mostrando {previewRows.length})
                                    </span>
                                </h3>
                                <div className="preview-table-wrapper">
                                    <table className="preview-table">
                                        <thead>
                                            <tr>
                                                {fileHeaders.map(h => <th key={h}>{h}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewRows.map((row, i) => (
                                                <tr key={i}>
                                                    {fileHeaders.map(h => (
                                                        <td key={h} title={String(row[h] || "")}>
                                                            {String(row[h] || "")}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Formulas */}
                        {showConfig && (
                            <div className="import-section">
                                <h3>🔧 Fórmulas</h3>
                                <p style={{ color: "#72777d", fontSize: "0.8125rem", marginBottom: "0.5rem" }}>
                                    Escribe expresiones como en Excel. Variables: <code>value</code> (valor actual), <code>row</code> (fila), <code>index</code> (nro. fila).
                                </p>
                                <p style={{ color: "#a2a9b1", fontSize: "0.75rem", marginBottom: "0.75rem", lineHeight: "1.5" }}>
                                    <strong>Texto:</strong> TRIM, UPPER, LOWER, CAPITALIZE, REPLACE, CONCAT, LEFT, RIGHT, SUBSTR, SPLIT, PAD, CLEAN, LEN
                                    &nbsp;·&nbsp;<strong>Números:</strong> NUM, ROUND, ABS, FLOOR, CEIL, MIN, MAX
                                    &nbsp;·&nbsp;<strong>Lógica:</strong> IF &nbsp;·&nbsp;<strong>Fecha:</strong> TODAY, YEAR
                                    &nbsp;·&nbsp;También funciones nativas de JS: <code>value.includes()</code>, <code>parseInt()</code>, etc.
                                </p>

                                {formulas.map((f, i) => (
                                    <div key={f.id} className="transform-row">
                                        {/* Badge: click to toggle type */}
                                        <div
                                            className={`transform-badge ${f.isNew ? "computed" : "column"}`}
                                            onClick={() => updateFormula(i, {
                                                isNew: !f.isNew,
                                                target: !f.isNew ? "" : (fileHeaders[0] || ""),
                                                expression: f.expression,
                                            })}
                                            style={{ cursor: "pointer" }}
                                            title="Clic para cambiar tipo"
                                        >
                                            {f.isNew ? "➕ Nueva" : "fx"}
                                        </div>

                                        {/* Target: column selector or text input */}
                                        {f.isNew ? (
                                            <input
                                                type="text"
                                                className="transform-input"
                                                value={f.target}
                                                onChange={(e) => updateFormula(i, { target: e.target.value })}
                                                placeholder="nombre_columna"
                                                style={{ width: 130 }}
                                            />
                                        ) : (
                                            <select
                                                className="transform-select"
                                                value={f.target}
                                                onChange={(e) => updateFormula(i, { target: e.target.value })}
                                            >
                                                <option value="__all__">✱ Todas</option>
                                                {fileHeaders.map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>
                                        )}

                                        <span className="mapping-arrow">=</span>

                                        {/* Expression input */}
                                        <input
                                            type="text"
                                            className="transform-input transform-expression"
                                            value={f.expression}
                                            onChange={(e) => updateFormula(i, { expression: e.target.value })}
                                            placeholder={f.isNew
                                                ? "CONCAT(row.nombre, \" \", row.apellido)"
                                                : "TRIM(value)"
                                            }
                                        />

                                        {/* Live sample */}
                                        {f.expression && (
                                            <div className="transform-sample" title={getFormulaSample(f)}>
                                                → {getFormulaSample(f) || "..."}
                                            </div>
                                        )}

                                        <button
                                            className="transform-remove"
                                            onClick={() => removeFormula(i)}
                                            title="Eliminar"
                                        >×</button>
                                    </div>
                                ))}

                                <div className="transform-actions">
                                    <button className="btn btn-secondary btn-sm" onClick={() => addFormula(false)}>
                                        + Modificar columna
                                    </button>
                                    <button className="btn btn-secondary btn-sm" onClick={() => addFormula(true)}>
                                        + Nueva columna
                                    </button>
                                    {formulas.length > 0 && (
                                        <button className="btn btn-primary btn-sm" onClick={previewFormulas}>
                                            ▶ Previsualizar
                                        </button>
                                    )}
                                </div>

                                {/* Formula Preview */}
                                {formulaPreview && (
                                    <div style={{ marginTop: "1rem" }}>
                                        <h4 style={{ marginBottom: "0.5rem", color: "#36c" }}>
                                            ✅ Vista previa transformada ({formulaPreview.rows.length} filas)
                                        </h4>
                                        <div className="preview-table-wrapper">
                                            <table className="preview-table">
                                                <thead>
                                                    <tr>
                                                        {formulaPreview.headers.map(h => <th key={h}>{h}</th>)}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {formulaPreview.preview.map((row, i) => (
                                                        <tr key={i}>
                                                            {formulaPreview.headers.map(h => (
                                                                <td key={h} title={String(row[h] ?? "")}>
                                                                    {String(row[h] ?? "")}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ========== SCHEMA BUILDER (schema mode) ========== */}
                        {showConfig && importMode === "schema" && (
                            <div className="import-section schema-builder">
                                <h3>🧩 Esquema de importación</h3>
                                <p style={{ color: "#72777d", fontSize: "0.8125rem", marginBottom: "0.75rem" }}>
                                    Define la estructura: por cada fila del archivo se crean entidades, claims, qualifiers y referencias.
                                    Usa expresiones con <code>row.columna</code> y funciones como <code>TRIM()</code>, <code>CONCAT()</code>.
                                </p>

                                {/* --- Entities --- */}
                                <div className="schema-section">
                                    <h4>🏷️ Entidades</h4>
                                    {Object.entries(schema.entities).map(([key, ent]) => (
                                        <div key={key} className="schema-card">
                                            <div className="schema-card-header">
                                                <span className="schema-badge entity">{key}</span>
                                                <button className="transform-remove" onClick={() => removeSchemaItem("entities", key)}>×</button>
                                            </div>
                                            <div className="schema-field-row">
                                                <label>label</label>
                                                <input type="text" className="transform-input transform-expression"
                                                    value={ent.label || ""} onChange={e => updateSchemaItem("entities", key, { label: e.target.value })}
                                                    placeholder="row.nombre" />
                                            </div>
                                            <div className="schema-field-row">
                                                <label>description</label>
                                                <input type="text" className="transform-input transform-expression"
                                                    value={ent.description || ""} onChange={e => updateSchemaItem("entities", key, { description: e.target.value })}
                                                    placeholder="row.descripcion" />
                                            </div>
                                            <div className="schema-field-row">
                                                <label>aliases</label>
                                                <input type="text" className="transform-input transform-expression"
                                                    value={ent.aliases || ""} onChange={e => updateSchemaItem("entities", key, { aliases: e.target.value })}
                                                    placeholder="[row.alias1, row.alias2].filter(Boolean)" />
                                            </div>

                                            {/* Match rule */}
                                            {schema.match[key] ? (
                                                <div className="schema-match-rule">
                                                    <div className="schema-field-row">
                                                        <label>🔍 Match by</label>
                                                        <select value={schema.match[key].by || "label"}
                                                            onChange={e => updateMatchRule(key, { by: e.target.value })}>
                                                            <option value="label">Solo label</option>
                                                            <option value="property">Solo propiedad</option>
                                                            <option value="label+property">Label + Propiedad</option>
                                                        </select>
                                                        <button className="transform-remove" onClick={() => removeMatchRule(key)} title="Quitar match">×</button>
                                                    </div>
                                                    {(schema.match[key].by === "property" || schema.match[key].by === "label+property") && (
                                                        <>
                                                            <EntityPickerField
                                                                fieldKey={`match.${key}.property`}
                                                                label="property ID"
                                                                value={schema.match[key].property || ""}
                                                                onChange={v => updateMatchRule(key, { property: v })}
                                                                placeholder="'P_CI'"
                                                            />
                                                            <div className="schema-field-row">
                                                                <label>value</label>
                                                                <input type="text" className="transform-input transform-expression"
                                                                    value={schema.match[key].value || ""} onChange={e => updateMatchRule(key, { value: e.target.value })}
                                                                    placeholder="row.ci" />
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                <button className="btn btn-sm" style={{ marginTop: "0.25rem", fontSize: "0.75rem" }}
                                                    onClick={() => updateMatchRule(key, { by: "label" })}>
                                                    + Agregar regla de match
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button className="btn btn-secondary btn-sm"
                                        onClick={() => addSchemaItem("entities", "entity", { label: "", description: "", aliases: "" })}>
                                        + Agregar entidad
                                    </button>
                                </div>

                                {/* --- Claims --- */}
                                <div className="schema-section">
                                    <h4>📝 Claims</h4>
                                    {Object.entries(schema.claims).map(([key, cl]) => (
                                        <div key={key} className="schema-card">
                                            <div className="schema-card-header">
                                                <span className="schema-badge claim">{key}</span>
                                                <button className="transform-remove" onClick={() => removeSchemaItem("claims", key)}>×</button>
                                            </div>
                                            <div className="schema-field-row">
                                                <label>subject</label>
                                                <select className="transform-select" value={cl.subject || ""}
                                                    onChange={e => updateSchemaItem("claims", key, { subject: e.target.value })}>
                                                    <option value="">— seleccionar entidad —</option>
                                                    {entitySymbolIds.map(id => <option key={id} value={id}>{id}</option>)}
                                                </select>
                                            </div>
                                            <EntityPickerField
                                                fieldKey={`claims.${key}.property`}
                                                label="property"
                                                value={cl.property || ""}
                                                onChange={v => updateSchemaItem("claims", key, { property: v })}
                                                placeholder="'P_CI'"
                                            />
                                            <div className="schema-field-row">
                                                <label>datatype</label>
                                                <select className="transform-select" value={cl.datatype || "'string'"}
                                                    onChange={e => updateSchemaItem("claims", key, { datatype: e.target.value })}>
                                                    <option value="'string'">string</option>
                                                    <option value="'number'">number</option>
                                                    <option value="'date'">date</option>
                                                    <option value="'boolean'">boolean</option>
                                                    <option value="'relation'">relation</option>
                                                    <option value="'json'">json</option>
                                                </select>
                                            </div>
                                            {cl.datatype === "'relation'" ? (
                                                <EntityPickerField
                                                    fieldKey={`claims.${key}.value_relation`}
                                                    label="value_relation"
                                                    value={cl.value_relation || ""}
                                                    onChange={v => updateSchemaItem("claims", key, { value_relation: v })}
                                                    placeholder="entity-0 o ID de entidad"
                                                />
                                            ) : (
                                                <div className="schema-field-row">
                                                    <label>value_raw</label>
                                                    <input type="text" className="transform-input transform-expression"
                                                        value={cl.value_raw || ""} onChange={e => updateSchemaItem("claims", key, { value_raw: e.target.value })}
                                                        placeholder="row.ci" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    <button className="btn btn-secondary btn-sm"
                                        onClick={() => addSchemaItem("claims", "claim", { subject: entitySymbolIds[0] || "", property: "", datatype: "'string'", value_raw: "", value_relation: "" })}>
                                        + Agregar claim
                                    </button>
                                </div>

                                {/* --- Qualifiers --- */}
                                <div className="schema-section">
                                    <h4>📎 Qualifiers</h4>
                                    {Object.entries(schema.qualifiers).map(([key, qual]) => (
                                        <div key={key} className="schema-card">
                                            <div className="schema-card-header">
                                                <span className="schema-badge qualifier">{key}</span>
                                                <button className="transform-remove" onClick={() => removeSchemaItem("qualifiers", key)}>×</button>
                                            </div>
                                            <div className="schema-field-row">
                                                <label>claim</label>
                                                <select className="transform-select" value={qual.claim || ""}
                                                    onChange={e => updateSchemaItem("qualifiers", key, { claim: e.target.value })}>
                                                    <option value="">— seleccionar claim —</option>
                                                    {claimSymbolIds.map(id => <option key={id} value={id}>{id}</option>)}
                                                </select>
                                            </div>
                                            <EntityPickerField
                                                fieldKey={`qualifiers.${key}.property`}
                                                label="property"
                                                value={qual.property || ""}
                                                onChange={v => updateSchemaItem("qualifiers", key, { property: v })}
                                                placeholder="'P_FECHA'"
                                            />
                                            <div className="schema-field-row">
                                                <label>datatype</label>
                                                <select className="transform-select" value={qual.datatype || "'string'"}
                                                    onChange={e => updateSchemaItem("qualifiers", key, { datatype: e.target.value })}>
                                                    <option value="'string'">string</option>
                                                    <option value="'number'">number</option>
                                                    <option value="'date'">date</option>
                                                    <option value="'boolean'">boolean</option>
                                                    <option value="'relation'">relation</option>
                                                </select>
                                            </div>
                                            {qual.datatype === "'relation'" ? (
                                                <EntityPickerField
                                                    fieldKey={`qualifiers.${key}.value_relation`}
                                                    label="value_relation"
                                                    value={qual.value_relation || ""}
                                                    onChange={v => updateSchemaItem("qualifiers", key, { value_relation: v })}
                                                    placeholder="entity-0 o ID de entidad"
                                                />
                                            ) : (
                                                <div className="schema-field-row">
                                                    <label>value_raw</label>
                                                    <input type="text" className="transform-input transform-expression"
                                                        value={qual.value_raw || ""} onChange={e => updateSchemaItem("qualifiers", key, { value_raw: e.target.value })}
                                                        placeholder="row.fecha_inicio" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    <button className="btn btn-secondary btn-sm"
                                        onClick={() => addSchemaItem("qualifiers", "qual", { claim: claimSymbolIds[0] || "", property: "", datatype: "'string'", value_raw: "" })}>
                                        + Agregar qualifier
                                    </button>
                                </div>

                                {/* --- References --- */}
                                <div className="schema-section">
                                    <h4>📚 References</h4>
                                    {Object.entries(schema.references).map(([key, ref]) => (
                                        <div key={key} className="schema-card">
                                            <div className="schema-card-header">
                                                <span className="schema-badge reference">{key}</span>
                                                <button className="transform-remove" onClick={() => removeSchemaItem("references", key)}>×</button>
                                            </div>
                                            <div className="schema-field-row">
                                                <label>claim</label>
                                                <select className="transform-select" value={ref.claim || ""}
                                                    onChange={e => updateSchemaItem("references", key, { claim: e.target.value })}>
                                                    <option value="">— seleccionar claim —</option>
                                                    {claimSymbolIds.map(id => <option key={id} value={id}>{id}</option>)}
                                                </select>
                                            </div>
                                            <EntityPickerField
                                                fieldKey={`references.${key}.reference`}
                                                label="reference"
                                                value={ref.reference || ""}
                                                onChange={v => updateSchemaItem("references", key, { reference: v })}
                                                placeholder="entity-0 o ID de entidad"
                                            />
                                            <div className="schema-field-row">
                                                <label>details</label>
                                                <input type="text" className="transform-input transform-expression"
                                                    value={ref.details || ""} onChange={e => updateSchemaItem("references", key, { details: e.target.value })}
                                                    placeholder="CONCAT('Fuente: ', row.fuente)" />
                                            </div>
                                        </div>
                                    ))}
                                    <button className="btn btn-secondary btn-sm"
                                        onClick={() => addSchemaItem("references", "ref", { claim: claimSymbolIds[0] || "", reference: "", details: "" })}>
                                        + Agregar referencia
                                    </button>
                                </div>

                                {/* Schema JSON editor + load/download */}
                                <div className="schema-json-section">
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                        <h4 style={{ margin: 0 }}>📄 JSON del esquema</h4>
                                        <div style={{ display: "flex", gap: "0.5rem" }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => schemaFileRef.current?.click()}>
                                                📂 Cargar JSON
                                            </button>
                                            <input type="file" ref={schemaFileRef} accept=".json" style={{ display: "none" }}
                                                onChange={e => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => {
                                                        try {
                                                            const loaded = JSON.parse(ev.target.result);
                                                            setSchema(prev => ({
                                                                entities: loaded.entities || prev.entities,
                                                                match: loaded.match || prev.match,
                                                                claims: loaded.claims || prev.claims,
                                                                qualifiers: loaded.qualifiers || prev.qualifiers,
                                                                references: loaded.references || prev.references,
                                                            }));
                                                            // Update counters based on loaded keys
                                                            const countMax = (obj, prefix) => {
                                                                let max = 0;
                                                                for (const k of Object.keys(obj || {})) {
                                                                    const n = parseInt(k.split("-").pop());
                                                                    if (!isNaN(n) && n >= max) max = n + 1;
                                                                }
                                                                return max;
                                                            };
                                                            setSchemaCounters({
                                                                entity: countMax(loaded.entities),
                                                                claim: countMax(loaded.claims),
                                                                qual: countMax(loaded.qualifiers),
                                                                ref: countMax(loaded.references),
                                                            });
                                                            setSchemaJsonText(JSON.stringify(loaded, null, 2));
                                                        } catch (err) {
                                                            alert("JSON inválido: " + err.message);
                                                        }
                                                    };
                                                    reader.readAsText(file);
                                                    e.target.value = "";
                                                }}
                                            />
                                            <button className="btn btn-secondary btn-sm" onClick={() => {
                                                const blob = new Blob([JSON.stringify(schema, null, 2)], { type: "application/json" });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement("a");
                                                a.href = url; a.download = "import-schema.json"; a.click();
                                                URL.revokeObjectURL(url);
                                            }}>
                                                💾 Descargar config
                                            </button>
                                        </div>
                                    </div>
                                    <textarea
                                        className="schema-json-editor"
                                        value={schemaJsonText}
                                        onChange={e => setSchemaJsonText(e.target.value)}
                                        rows={12}
                                    />
                                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                                        <button className="btn btn-primary btn-sm" onClick={() => {
                                            try {
                                                const parsed = JSON.parse(schemaJsonText);
                                                setSchema({
                                                    entities: parsed.entities || {},
                                                    match: parsed.match || {},
                                                    claims: parsed.claims || {},
                                                    qualifiers: parsed.qualifiers || {},
                                                    references: parsed.references || {},
                                                });
                                                const countMax = (obj) => {
                                                    let max = 0;
                                                    for (const k of Object.keys(obj || {})) {
                                                        const n = parseInt(k.split("-").pop());
                                                        if (!isNaN(n) && n >= max) max = n + 1;
                                                    }
                                                    return max;
                                                };
                                                setSchemaCounters({
                                                    entity: countMax(parsed.entities),
                                                    claim: countMax(parsed.claims),
                                                    qual: countMax(parsed.qualifiers),
                                                    ref: countMax(parsed.references),
                                                });
                                            } catch (err) {
                                                alert("JSON inválido: " + err.message);
                                            }
                                        }}>
                                            ✅ Aplicar JSON
                                        </button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setSchemaJsonText(JSON.stringify(schema, null, 2))}>
                                            🔄 Sincronizar desde UI
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Mapping (flat mode only) */}
                        {showConfig && importMode === "flat" && (
                            <div className="import-section">
                                <h3>🔗 Mapeo de campos</h3>
                                <p style={{ color: "#72777d", fontSize: "0.8125rem", marginBottom: "0.75rem" }}>
                                    Asigna cada columna del archivo a un campo de la colección destino.
                                    Mapea a <strong>$id</strong> para usar IDs personalizados.
                                </p>
                                {mappings.map((m, i) => {
                                    const targetFields = COLLECTION_FIELDS[targetCollection] || [];
                                    return (
                                        <div key={i} className="mapping-row">
                                            <div className="mapping-source">{m.source}</div>
                                            <span className="mapping-arrow">→</span>
                                            <div className="mapping-target">
                                                <select
                                                    value={m.target}
                                                    onChange={(e) => updateMappingTarget(i, e.target.value)}
                                                >
                                                    <option value="">(ignorar)</option>
                                                    {targetFields.map(f => (
                                                        <option key={f} value={f}>{f}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="mapping-target">
                                                <select
                                                    value={m.transform}
                                                    onChange={(e) => updateMappingTransform(i, e.target.value)}
                                                >
                                                    {TRANSFORMS.map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Import Button */}
                        {showConfig && !importing && (
                            <div className="import-actions">
                                <button className="btn btn-primary" onClick={runImport}>
                                    🚀 Iniciar importación
                                </button>
                            </div>
                        )}

                        {/* Progress */}
                        {importing && (
                            <div className="progress-section">
                                <div className="import-section">
                                    <h3><span className="import-spinner" /> Importando...</h3>
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                                    </div>
                                    <p className="progress-text">{progressText}</p>
                                </div>
                            </div>
                        )}

                        {/* Results */}
                        {result && (
                            <div style={{ marginTop: "1.5rem" }}>
                                {result.success ? (
                                    <div className="result-box success">
                                        <h3 className="result-title-success">✅ Importación completada</h3>

                                        {result.mode === "schema" ? (
                                            /* Schema mode results */
                                            <div className="result-stats">
                                                <div className="stat">
                                                    <div className="stat-value">{result.total}</div>
                                                    <div className="stat-label">Filas</div>
                                                </div>
                                                <div className="stat">
                                                    <div className="stat-value stat-value-success">{result.entities || 0}</div>
                                                    <div className="stat-label">Entidades</div>
                                                </div>
                                                <div className="stat">
                                                    <div className="stat-value" style={{ color: "#3366cc" }}>{result.matched || 0}</div>
                                                    <div className="stat-label">Matches</div>
                                                </div>
                                                <div className="stat">
                                                    <div className="stat-value stat-value-success">{result.claims || 0}</div>
                                                    <div className="stat-label">Claims</div>
                                                </div>
                                                <div className="stat">
                                                    <div className="stat-value stat-value-success">{result.qualifiers || 0}</div>
                                                    <div className="stat-label">Qualifiers</div>
                                                </div>
                                                <div className="stat">
                                                    <div className="stat-value stat-value-success">{result.references || 0}</div>
                                                    <div className="stat-label">Referencias</div>
                                                </div>
                                                <div className="stat">
                                                    <div className={`stat-value ${result.errors?.length ? "stat-value-error" : "stat-value-dim"}`}>
                                                        {result.errors?.length || 0}
                                                    </div>
                                                    <div className="stat-label">Errores</div>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Flat mode results */
                                            <>
                                                <div className="result-stats">
                                                    <div className="stat">
                                                        <div className="stat-value">{result.total}</div>
                                                        <div className="stat-label">Total</div>
                                                    </div>
                                                    <div className="stat">
                                                        <div className="stat-value stat-value-success">{result.created}</div>
                                                        <div className="stat-label">Creados</div>
                                                    </div>
                                                    <div className="stat">
                                                        <div className={`stat-value ${result.errors?.length ? "stat-value-error" : "stat-value-dim"}`}>
                                                            {result.errors?.length || 0}
                                                        </div>
                                                        <div className="stat-label">Errores</div>
                                                    </div>
                                                </div>

                                                {result.documents?.length > 0 && (
                                                    <div className="download-actions">
                                                        <button className="btn btn-secondary" onClick={downloadCsv}>
                                                            📥 Descargar CSV con $id
                                                        </button>
                                                        <button className="btn btn-secondary" onClick={downloadJson}>
                                                            📥 Descargar JSON con $id
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {result.errors?.length > 0 && (
                                            <>
                                                <h4 style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>Errores:</h4>
                                                <div className="errors-list">
                                                    {result.errors.map((e, i) => (
                                                        <div key={i} className="error-item">
                                                            Fila {e.row}: {e.error}
                                                        </div>
                                                    ))}
                                                </div>
                                                {result.hasMoreErrors && (
                                                    <p style={{ color: "#b58105", marginTop: "0.5rem", fontSize: "0.8125rem" }}>
                                                        ⚠️ Se muestran los primeros 50 errores.
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="result-box error">
                                        <h3 className="result-title-error">❌ Error en la importación</h3>
                                        <pre className="api-docs-pre">
                                            {result.error || JSON.stringify(result, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* =========== DOCS TAB =========== */}
                    <div className={`import-panel ${activeTab === "docs" ? "active" : ""}`}>
                        <div className="import-section">
                            <h3>📖 Documentación de la API</h3>
                            <p style={{ color: "#72777d", marginBottom: "1.5rem" }}>
                                Usa la función <code>import-data</code> para importar datos programáticamente vía POST.
                            </p>

                            <div className="api-docs-section">
                                <h4><span className="badge badge-post">POST</span> Importar entidades desde CSV</h4>
                                <pre className="api-docs-pre">{`curl -X POST "$ENDPOINT/v1/functions/import-data/executions" \\
  -H "Content-Type: application/json" \\
  -H "X-Appwrite-Project: $PROJECT_ID" \\
  -H "X-Appwrite-Key: $API_KEY" \\
  -d '{
    "body": "{\\"targetCollection\\":\\"entities\\",\\"csvData\\":\\"label,description,aliases\\\\nTierra,Tercer planeta,Tierra|Terra|Earth\\\\nLuna,Satélite natural,Luna|Moon\\",\\"fields\\":[{\\"source\\":\\"label\\",\\"target\\":\\"label\\"},{\\"source\\":\\"description\\",\\"target\\":\\"description\\"},{\\"source\\":\\"aliases\\",\\"target\\":\\"aliases\\",\\"transform\\":\\"array\\"}]}"
  }'`}</pre>
                            </div>

                            <div className="api-docs-section">
                                <h4><span className="badge badge-post">POST</span> Importar con $id personalizado</h4>
                                <pre className="api-docs-pre">{`curl -X POST "$ENDPOINT/v1/functions/import-data/executions" \\
  -H "Content-Type: application/json" \\
  -H "X-Appwrite-Project: $PROJECT_ID" \\
  -H "X-Appwrite-Key: $API_KEY" \\
  -d '{
    "body": "{\\"targetCollection\\":\\"entities\\",\\"rows\\":[{\\"myid\\":\\"Q1\\",\\"name\\":\\"Entidad 1\\",\\"desc\\":\\"Descripción 1\\"}],\\"fields\\":[{\\"source\\":\\"myid\\",\\"target\\":\\"$id\\"},{\\"source\\":\\"name\\",\\"target\\":\\"label\\"},{\\"source\\":\\"desc\\",\\"target\\":\\"description\\"}]}"
  }'`}</pre>
                            </div>

                            <div className="api-docs-section">
                                <h4>📦 Esquema del Request Body</h4>
                                <pre className="api-docs-pre">{`{
  "targetCollection": "entities | claims | qualifiers | references",
  "hasHeader": true,
  "delimiter": ",",
  "useBatch": false,
  "batchSize": 50,

  // Datos (usar UNA opción):
  "csvData": "col1,col2\\nval1,val2",
  "jsonData": [{"col1":"val1"}],
  "rows": [{"col1":"val1","col2":"val2"}],

  // Mapeo de campos (REQUERIDO):
  "fields": [
    {
      "source": "columna_origen",
      "target": "$id | label | description | ...",
      "transform": "string | number | boolean | json | array"
    }
  ]
}`}</pre>
                            </div>

                            <div className="api-docs-section">
                                <h4>📋 Campos por colección</h4>
                                <pre className="api-docs-pre">{`entities:    $id, label, description, aliases
claims:      $id, subject, property, datatype, value_raw, value_relation
qualifiers:  $id, claim, property, datatype, value_raw, value_relation
references:  $id, claim, reference, details

$id: ID personalizado (opcional, se genera automático si no se provee)`}</pre>
                            </div>

                            <div className="api-docs-section">
                                <h4>✅ Respuesta</h4>
                                <pre className="api-docs-pre">{`{
  "success": true,
  "total": 100,
  "created": 98,
  "documents": [{ "$id": "abc123", "label": "...", ... }],
  "errors": [{ "row": 5, "error": "..." }],
  "hasMoreErrors": false
}`}</pre>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}

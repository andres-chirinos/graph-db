"use client";

import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { LoadingState } from "@/components";
import "./style.css";

const FUNCTION_ID = "import-data";

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

function parseJsonText(text) {
    let data = JSON.parse(text);
    if (!Array.isArray(data)) {
        data = data.data || data.items || data.rows || [];
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

    // Config
    const [targetCollection, setTargetCollection] = useState("entities");
    const [insertMode, setInsertMode] = useState("single");
    const [functionUrl, setFunctionUrl] = useState("");

    // Mapping
    const [mappings, setMappings] = useState([]);

    // Import state
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState("");
    const [result, setResult] = useState(null);

    const showConfig = fileHeaders.length > 0;

    // === File Handling ===
    const handleFile = useCallback((file) => {
        setFileName(`📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
        setResult(null);

        const ext = file.name.split(".").pop().toLowerCase();

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
                    const { headers, rows } = parseJsonText(e.target.result);
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
        // Re-map fields
        const targetFields = COLLECTION_FIELDS[value] || [];
        setMappings(prev => prev.map(m => ({
            ...m,
            target: autoMapField(m.source, targetFields),
            transform: autoTransform(autoMapField(m.source, targetFields)),
        })));
    }

    // === Import ===
    async function runImport() {
        const fields = mappings.filter(m => m.target);
        if (fields.length === 0) {
            alert("Debes mapear al menos un campo.");
            return;
        }

        setImporting(true);
        setProgress(10);
        setProgressText(`Enviando ${allRows.length} filas...`);
        setResult(null);

        try {
            const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
            const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

            // The import-data function URL
            const url = functionUrl.trim()
                || `${endpoint}/v1/functions/${FUNCTION_ID}/executions`;

            const payload = {
                targetCollection,
                rows: allRows,
                fields: fields.map(f => ({ source: f.source, target: f.target, transform: f.transform })),
                useBatch: insertMode === "batch",
                batchSize: 50,
            };

            setProgress(30);
            setProgressText("Procesando importación en el servidor...");

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Appwrite-Project": projectId,
                },
                body: JSON.stringify({
                    body: JSON.stringify(payload),
                }),
            });

            setProgress(90);

            const data = await response.json();

            // Appwrite wraps function output in responseBody
            let importResult = data;
            if (data.responseBody) {
                try { importResult = JSON.parse(data.responseBody); } catch { importResult = data; }
            }

            setProgress(100);
            setResult(importResult);
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

                        {/* Config */}
                        {showConfig && (
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
                                    <div className="config-field">
                                        <label>URL de la función (opcional)</label>
                                        <input
                                            type="text"
                                            value={functionUrl}
                                            onChange={(e) => setFunctionUrl(e.target.value)}
                                            placeholder={`Auto: /v1/functions/${FUNCTION_ID}/executions`}
                                            style={{ width: 320 }}
                                        />
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

                        {/* Mapping */}
                        {showConfig && (
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

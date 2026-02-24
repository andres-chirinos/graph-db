"use client";

import { useState, useEffect } from "react";
import EntitySelector from "./EntitySelector";
import ValueInput from "./ValueInput";
import "./InlineClaimForm.css";

/**
 * Inline form to quickly create a claim (Wikidata style).
 * Replaces the modal flow.
 */
export default function InlineClaimForm({
    onSave,
    onCancel,
    subjectId,
    loading = false,
}) {
    const [property, setProperty] = useState("");

    // Smart state
    const [valueType, setValueType] = useState("raw");
    const [valueRaw, setValueRaw] = useState({ datatype: "string", data: "" });
    const [valueRelation, setValueRelation] = useState("");

    const [error, setError] = useState(null);

    // Auto-detect datatype based on input
    useEffect(() => {
        if (valueType === "raw" && typeof valueRaw.data === "string") {
            const text = valueRaw.data;
            if (!text) return;

            // Smart detection
            let detectedType = valueRaw.datatype;

            const isUrl = (val) => {
                try {
                    const u = new URL(val);
                    return u.protocol === "http:" || u.protocol === "https:";
                } catch { return false; }
            };

            const isDate = (val) => {
                return /^\d{4}-\d{2}-\d{2}$/.test(val) && !isNaN(Date.parse(val));
            };

            const isNumeric = (val) => {
                return !isNaN(parseFloat(val)) && isFinite(val) && !val.includes(" ");
            };

            if (isUrl(text)) {
                detectedType = "url";
            } else if (isDate(text)) {
                detectedType = "date";
            } else if (isNumeric(text)) {
                detectedType = "number";
            } else {
                // Fallback string if not explicitly forced to something else
                if (["url", "number", "date"].includes(detectedType)) {
                    detectedType = "string";
                }
            }

            if (detectedType !== valueRaw.datatype) {
                setValueRaw((prev) => ({ ...prev, datatype: detectedType }));
            }
        }
    }, [valueRaw.data, valueType]);

    async function handleSubmit(e) {
        if (e) e.preventDefault();
        if (!property) {
            setError("La propiedad es obligatoria");
            return;
        }

        setError(null);

        try {
            const resolvedDatatype =
                valueType === "relation"
                    ? "entity"
                    : valueRaw.datatype || "string";

            let finalValueRaw = null;
            if (valueType === "raw") {
                if (valueRaw.datatype === "image" || valueRaw.datatype === "polygon") {
                    finalValueRaw = valueRaw.data?.url ?? null;
                } else {
                    finalValueRaw = valueRaw.data ?? null;
                }
            }

            const data = {
                subject: subjectId,
                property: property,
                datatype: resolvedDatatype,
                value_raw: finalValueRaw,
                value_relation: valueType === "relation" ? valueRelation : null,
            };

            await onSave(data);
            // Parent component will unmount this or we clear the form
            setProperty("");
            setValueRaw({ datatype: "string", data: "" });
            setValueRelation("");
        } catch (err) {
            setError(err.message || "Error al guardar el claim");
        }
    }

    return (
        <div className="inline-claim-form">
            {error && <div className="form-error inline-error">{error}</div>}

            <div className="inline-claim-grid">
                <div className="inline-claim-property">
                    <EntitySelector
                        value={property}
                        onChange={setProperty}
                        placeholder="Propiedad..."
                        className="compact-selector"
                    />
                </div>

                <div className="inline-claim-value-type">
                    <select
                        className="form-select compact-select"
                        value={valueType}
                        onChange={(e) => {
                            setValueType(e.target.value);
                            if (e.target.value === "relation") setValueRaw({ datatype: "string", data: "" });
                            if (e.target.value === "raw") setValueRelation("");
                        }}
                    >
                        <option value="raw">Literal (auto)</option>
                        <option value="relation">Entidad</option>
                    </select>
                </div>

                <div className="inline-claim-value">
                    {valueType === "raw" ? (
                        <ValueInput
                            value={valueRaw}
                            onChange={setValueRaw}
                            disabled={loading}
                        />
                    ) : (
                        <EntitySelector
                            value={valueRelation}
                            onChange={setValueRelation}
                            placeholder="Entidad relacionada..."
                            excludeIds={[subjectId]}
                            className="compact-selector"
                        />
                    )}
                </div>

                <div className="inline-claim-actions">
                    <button
                        type="button"
                        className="btn-icon btn-save"
                        onClick={handleSubmit}
                        disabled={loading || !property || (valueType === "raw" ? !valueRaw.data : !valueRelation)}
                        title="Guardar"
                    >
                        <span className="icon-check"></span>
                    </button>
                    <button
                        type="button"
                        className="btn-icon btn-cancel"
                        onClick={onCancel}
                        disabled={loading}
                        title="Cancelar"
                    >
                        <span className="icon-x"></span>
                    </button>
                </div>
            </div>
        </div>
    );
}

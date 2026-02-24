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
    initialData = null,
    loading = false,
}) {
    const isEditing = !!initialData;
    const [property, setProperty] = useState(initialData?.property?.$id || "");

    // Smart state
    const [valueType, setValueType] = useState(initialData?.value_relation ? "relation" : "raw");

    const getInitialValueRaw = () => {
        if (!initialData) return { datatype: "string", data: "" };
        const dt = initialData.datatype || initialData.property?.datatype || "string";
        let data = initialData.value_raw;
        if (typeof data === "string") {
            try {
                const parsed = JSON.parse(data);
                if (parsed && typeof parsed === "object" && parsed.datatype !== undefined) {
                    return { datatype: parsed.datatype || dt, data: parsed.data };
                }
            } catch { /* keep as string */ }
        } else if (typeof data === "object" && data !== null && data.datatype !== undefined) {
            return { datatype: data.datatype || dt, data: data.data };
        }

        if (dt === "polygon" || dt === "image") {
            if (typeof data === "object" && data?.url) data = data.url;
            else if (typeof data === "object") {
                try { data = JSON.stringify(data); } catch { data = String(data); }
            }
        }

        return { datatype: dt, data: data ?? "" };
    };

    const [valueRaw, setValueRaw] = useState(getInitialValueRaw());
    const [valueRelation, setValueRelation] = useState(initialData?.value_relation?.$id || "");

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
                property: property,
                datatype: resolvedDatatype,
                value_raw: finalValueRaw,
                value_relation: valueType === "relation" ? valueRelation : null,
            };

            if (!isEditing && subjectId) {
                data.subject = subjectId;
            }

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

                <div className="inline-claim-value-type" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', margin: 0 }} title="¿El valor es una relación con otra entidad?">
                        <input
                            type="checkbox"
                            checked={valueType === "relation"}
                            onChange={(e) => {
                                const newType = e.target.checked ? "relation" : "raw";
                                setValueType(newType);
                                if (newType === "relation") setValueRaw({ datatype: "string", data: "" });
                                if (newType === "raw") setValueRelation("");
                            }}
                        />
                        Entidad
                    </label>
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
                        disabled={loading || !property || (valueType === "raw" ? (valueRaw.data === "" || valueRaw.data === null || valueRaw.data === undefined) : !valueRelation)}
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

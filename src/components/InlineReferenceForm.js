"use client";

import { useState } from "react";
import EntitySelector from "./EntitySelector";
import "./InlineClaimForm.css"; // Reuse same layout CSS

/**
 * Inline form to quickly create or edit a reference
 */
export default function InlineReferenceForm({
    onSave,
    onCancel,
    claimId,
    initialData = null,
    loading = false,
}) {
    const isEditing = !!initialData;
    const [referenceEntity, setReferenceEntity] = useState(
        initialData?.reference?.$id || ""
    );
    const [details, setDetails] = useState(initialData?.details || "");
    const [error, setError] = useState(null);

    async function handleSubmit(e) {
        if (e) e.preventDefault();
        setError(null);

        try {
            const data = {
                reference: referenceEntity || null,
                details: details || null,
            };

            if (!isEditing && claimId) {
                data.claim = claimId;
            }

            await onSave(data);
            setReferenceEntity("");
            setDetails("");
        } catch (err) {
            setError(err.message || "Error al guardar la referencia");
        }
    }

    return (
        <div className="inline-claim-form" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
            {error && <div className="form-error inline-error">{error}</div>}

            <div className="inline-claim-grid" style={{ gridTemplateColumns: '1fr 2fr auto' }}>
                <div className="inline-claim-property">
                    <EntitySelector
                        value={referenceEntity}
                        onChange={setReferenceEntity}
                        placeholder="Fuente (Entidad)..."
                        className="compact-selector"
                    />
                </div>

                <div className="inline-claim-value">
                    <input
                        type="text"
                        className="form-input"
                        style={{ width: '100%', margin: 0 }}
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        placeholder="Detalles (página, capítulo, fecha)..."
                        disabled={loading}
                    />
                </div>

                <div className="inline-claim-actions">
                    <button
                        type="button"
                        className="btn-icon btn-save"
                        onClick={handleSubmit}
                        disabled={loading || (!referenceEntity && !details)}
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

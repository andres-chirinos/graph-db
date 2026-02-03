"use client";

import { useState } from "react";
import EditModal from "./EditModal";
import EntitySelector from "./EntitySelector";
import ValueInput from "./ValueInput";

/**
 * Formulario para crear/editar un qualifier
 */
export default function QualifierForm({
  isOpen,
  onClose,
  onSave,
  qualifier = null,
  claimId,
}) {
  const isEditing = !!qualifier;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [property, setProperty] = useState(qualifier?.property?.$id || "");
  const [valueType, setValueType] = useState(
    qualifier?.value_relation ? "relation" : "raw"
  );
  const [valueRaw, setValueRaw] = useState(() => {
    if (qualifier?.value_raw) {
      try {
        return typeof qualifier.value_raw === "string" 
          ? JSON.parse(qualifier.value_raw) 
          : qualifier.value_raw;
      } catch {
        return { datatype: "string", data: qualifier.value_raw };
      }
    }
    return { datatype: "string", data: "" };
  });
  const [valueRelation, setValueRelation] = useState(
    qualifier?.value_relation?.$id || ""
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = {
        property: property || null,
        value_raw: valueType === "raw" ? valueRaw : null,
        value_relation: valueType === "relation" ? valueRelation : null,
      };

      if (!isEditing) {
        data.claim = claimId;
      }

      await onSave(data, qualifier?.$id);
      onClose();
    } catch (err) {
      setError(err.message || "Error al guardar el qualifier");
    } finally {
      setLoading(false);
    }
  }

  return (
    <EditModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Editar calificador" : "Nuevo calificador"}
      onSubmit={handleSubmit}
      submitLabel={isEditing ? "Guardar cambios" : "Crear calificador"}
      loading={loading}
      size="medium"
    >
      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <EntitySelector
          label="Propiedad"
          value={property}
          onChange={setProperty}
          placeholder="Buscar propiedad..."
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Tipo de valor</label>
        <div className="radio-group">
          <label className="radio-label">
            <input
              type="radio"
              name="valueType"
              value="raw"
              checked={valueType === "raw"}
              onChange={() => setValueType("raw")}
            />
            Valor literal
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="valueType"
              value="relation"
              checked={valueType === "relation"}
              onChange={() => setValueType("relation")}
            />
            Relación a entidad
          </label>
        </div>
      </div>

      {valueType === "raw" ? (
        <div className="form-group">
          <ValueInput
            label="Valor"
            value={valueRaw}
            onChange={setValueRaw}
            required
          />
        </div>
      ) : (
        <div className="form-group">
          <EntitySelector
            label="Entidad relacionada"
            value={valueRelation}
            onChange={setValueRelation}
            placeholder="Buscar entidad..."
            required
          />
        </div>
      )}
    </EditModal>
  );
}

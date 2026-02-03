"use client";

import { useState } from "react";
import EditModal from "./EditModal";
import EntitySelector from "./EntitySelector";

/**
 * Formulario para crear/editar una referencia
 */
export default function ReferenceForm({
  isOpen,
  onClose,
  onSave,
  reference = null,
  claimId,
}) {
  const isEditing = !!reference;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [referenceEntity, setReferenceEntity] = useState(
    reference?.reference?.$id || ""
  );
  const [details, setDetails] = useState(reference?.details || "");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = {
        reference: referenceEntity || null,
        details: details || null,
      };

      if (!isEditing) {
        data.claim = claimId;
      }

      await onSave(data, reference?.$id);
      onClose();
    } catch (err) {
      setError(err.message || "Error al guardar la referencia");
    } finally {
      setLoading(false);
    }
  }

  return (
    <EditModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Editar referencia" : "Nueva referencia"}
      onSubmit={handleSubmit}
      submitLabel={isEditing ? "Guardar cambios" : "Crear referencia"}
      loading={loading}
      size="medium"
    >
      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <EntitySelector
          label="Entidad de referencia"
          value={referenceEntity}
          onChange={setReferenceEntity}
          placeholder="Buscar fuente, documento, etc..."
        />
        <p className="form-hint">
          Selecciona una entidad que sirva como fuente (libro, artículo, sitio web, etc.)
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Detalles adicionales</label>
        <textarea
          className="form-textarea"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Página, capítulo, URL específica, fecha de acceso, etc."
          rows={3}
        />
      </div>
    </EditModal>
  );
}

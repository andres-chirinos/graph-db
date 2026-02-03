"use client";

import { useState } from "react";
import EditModal from "./EditModal";

/**
 * Formulario para crear/editar una entidad
 */
export default function EntityForm({
  isOpen,
  onClose,
  onSave,
  entity = null,
}) {
  const isEditing = !!entity;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [label, setLabel] = useState(entity?.label || "");
  const [description, setDescription] = useState(entity?.description || "");
  const [aliasesText, setAliasesText] = useState(
    entity?.aliases?.join(", ") || ""
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const aliases = aliasesText
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0);

      const data = {
        label: label || null,
        description: description || null,
        aliases,
      };

      await onSave(data, entity?.$id);
      onClose();
    } catch (err) {
      setError(err.message || "Error al guardar la entidad");
    } finally {
      setLoading(false);
    }
  }

  return (
    <EditModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Editar entidad" : "Nueva entidad"}
      onSubmit={handleSubmit}
      submitLabel={isEditing ? "Guardar cambios" : "Crear entidad"}
      loading={loading}
      size="medium"
    >
      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <label className="form-label">
          Etiqueta
          <span className="required">*</span>
        </label>
        <input
          type="text"
          className="form-input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nombre o título de la entidad"
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Descripción</label>
        <textarea
          className="form-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Breve descripción de la entidad"
          rows={3}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Alias</label>
        <input
          type="text"
          className="form-input"
          value={aliasesText}
          onChange={(e) => setAliasesText(e.target.value)}
          placeholder="Nombres alternativos, separados por comas"
        />
        <p className="form-hint">
          Nombres alternativos o sinónimos, separados por comas
        </p>
      </div>
    </EditModal>
  );
}

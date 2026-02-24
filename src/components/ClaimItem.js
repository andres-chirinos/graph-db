"use client";

import { useState } from "react";
import Link from "next/link";
import ValueRenderer from "./ValueRenderer";
import QualifierForm from "./QualifierForm";
import ReferenceForm from "./ReferenceForm";
import { ConfirmModal } from "./EditModal";
import PermissionsModal from "./PermissionsModal";
import { updateClaimPermissions } from "@/lib/database";
import QualifierItem from "./QualifierItem";
import ReferenceItem from "./ReferenceItem";
import InlineClaimForm from "./InlineClaimForm";
import InlineReferenceForm from "./InlineReferenceForm";

function normalizeValue(valueRaw, datatype = "string") {
  if (valueRaw === null || valueRaw === undefined) return null;

  let data = valueRaw;
  if (typeof valueRaw === "string") {
    try {
      const parsed = JSON.parse(valueRaw);
      if (parsed && typeof parsed === "object" && parsed.datatype !== undefined && parsed.data !== undefined) {
        return { datatype: parsed.datatype || datatype, data: parsed.data };
      }
      if (["json", "object", "array"].includes(datatype)) {
        data = parsed;
      }
    } catch {
      data = valueRaw;
    }
  }

  return { datatype, data };
}

/**
 * Muestra un claim individual con su propiedad, valor, qualifiers y referencias
 */
export default function ClaimItem({
  claim,
  showQualifiers = true,
  showReferences = true,
  editable = false,
  onEdit,
  onDelete,
  onQualifierCreate,
  onQualifierUpdate,
  onQualifierDelete,
  onReferenceCreate,
  onReferenceUpdate,
  onReferenceDelete,
}) {
  if (!claim) return null;

  const { $id, property, value_raw, value_relation, qualifiersList, referencesList, datatype } = claim;

  // Normalizar value_raw usando el datatype de la fila
  const parsedValue = normalizeValue(value_raw, datatype || property?.datatype || "string");

  // Estados para modales y edición
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete?.(claim.$id);
      setShowDeleteConfirm(false);
    } catch (e) {
      console.error("Error deleting claim:", e);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="claim-item">
      {isEditingInline ? (
        <InlineClaimForm
          initialData={claim}
          loading={saving}
          onCancel={() => setIsEditingInline(false)}
          onSave={async (data) => {
            setSaving(true);
            try {
              await onEdit?.(data, claim.$id);
              setIsEditingInline(false);
            } finally {
              setSaving(false);
            }
          }}
          subjectId={claim.subject}
        />
      ) : (
        <div className="claim-main">
          {/* Propiedad */}
          <div className="claim-property">
            {property ? (
              <Link href={`/entity/${property.$id}`} className="property-link">
                {property.label || property.$id}
              </Link>
            ) : (
              <span className="property-unknown">(Propiedad desconocida)</span>
            )}
          </div>

          {/* Valor */}
          <div className="claim-value">
            {value_relation ? (
              <Link href={`/entity/${value_relation.$id}`} className="value-entity-link">
                {value_relation.label || value_relation.$id}
              </Link>
            ) : parsedValue ? (
              <ValueRenderer value={parsedValue} />
            ) : (
              <span className="value-empty">(Sin valor)</span>
            )}
          </div>

          {/* Acciones del claim */}
          {editable && (
            <div className="claim-actions">
              <button
                type="button"
                className="btn-icon btn-edit"
                onClick={() => setIsEditingInline(true)}
                title="Editar declaración"
              >
                ✎
              </button>
              <button
                type="button"
                className="btn-icon btn-edit"
                onClick={() => setShowPermissions(true)}
                title="Permisos"
              >
                🔐
              </button>
              <button
                type="button"
                className="btn-icon btn-delete"
                onClick={() => setShowDeleteConfirm(true)}
                title="Eliminar declaración"
              >
                🗑
              </button>
            </div>
          )}
        </div>
      )}

      {/* Qualifiers */}
      {showQualifiers && (
        <div className="claim-qualifiers">
          {qualifiersList && qualifiersList.length > 0 && (
            qualifiersList.map((qualifier) => (
              <QualifierItem
                key={qualifier.$id}
                qualifier={qualifier}
                editable={editable}
                onEdit={onQualifierUpdate}
                onDelete={onQualifierDelete}
              />
            ))
          )}
          {editable && (
            <AddQualifierButton
              claimId={$id}
              onSave={onQualifierCreate}
            />
          )}
        </div>
      )}

      {/* Referencias */}
      {showReferences && (
        <div className="claim-references">
          <details className="references-toggle">
            <summary>
              <span className="icon-info"></span>
              {referencesList?.length || 0} referencia{(referencesList?.length || 0) !== 1 ? "s" : ""}
            </summary>
            <div className="references-list">
              {referencesList?.map((ref) => (
                <ReferenceItem
                  key={ref.$id}
                  reference={ref}
                  editable={editable}
                  onEdit={onReferenceUpdate}
                  onDelete={onReferenceDelete}
                />
              ))}
              {editable && (
                <AddReferenceButton
                  claimId={$id}
                  onSave={onReferenceCreate}
                />
              )}
            </div>
          </details>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Eliminar declaración"
        message="¿Estás seguro de que deseas eliminar esta declaración? También se eliminarán todos sus calificadores y referencias."
        loading={deleting}
      />

      <PermissionsModal
        isOpen={showPermissions}
        onClose={() => setShowPermissions(false)}
        title="Permisos del claim"
        permissions={claim.$permissions || []}
        onSave={async (permissions) => {
          await updateClaimPermissions(claim.$id, permissions);
        }}
      />
    </div>
  );
}

/**
 * Botón para añadir un qualifier
 */
function AddQualifierButton({ claimId, onSave }) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn-add-inline"
        onClick={() => setShowForm(true)}
        disabled={loading}
      >
        + Añadir calificador
      </button>

      {showForm && (
        <InlineClaimForm
          loading={loading}
          onCancel={() => setShowForm(false)}
          onSave={async (data) => {
            setLoading(true);
            try {
              await onSave?.({ ...data, claim: claimId });
              setShowForm(false);
            } finally {
              setLoading(false);
            }
          }}
        />
      )}
    </>
  );
}

/**
 * Botón para añadir una referencia
 */
function AddReferenceButton({ claimId, onSave }) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn-add-inline"
        onClick={() => setShowForm(true)}
        disabled={loading}
      >
        + Añadir referencia
      </button>

      {showForm && (
        <InlineReferenceForm
          loading={loading}
          onCancel={() => setShowForm(false)}
          onSave={async (data) => {
            setLoading(true);
            try {
              await onSave?.({ ...data, claim: claimId });
              setShowForm(false);
            } finally {
              setLoading(false);
            }
          }}
        />
      )}
    </>
  );
}
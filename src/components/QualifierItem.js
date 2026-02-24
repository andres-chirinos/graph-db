"use client";

import { useState } from "react";
import Link from "next/link";
import ValueRenderer from "./ValueRenderer";
import InlineClaimForm from "./InlineClaimForm";
import { ConfirmModal } from "./EditModal";
import PermissionsModal from "./PermissionsModal";
import { updateQualifierPermissions } from "@/lib/database";
import "./QualifierItem.css";

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
 * Muestra un qualifier
 */
export default function QualifierItem({ qualifier, editable, onEdit, onDelete }) {
    const { property, value_raw, value_relation, datatype } = qualifier;
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [showPermissions, setShowPermissions] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [saving, setSaving] = useState(false);

    const parsedValue = normalizeValue(value_raw, datatype || property?.datatype || "string");

    async function handleDelete() {
        setDeleting(true);
        try {
            await onDelete?.(qualifier.$id, qualifier.claim);
            setShowDeleteConfirm(false);
        } catch (e) {
            console.error("Error deleting qualifier:", e);
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div className="qualifier-item">
            {!showEditForm ? (
                <>
                    <span className="qualifier-property">
                        {property ? (
                            <Link href={`/entity/${property.$id}`}>
                                {property.label || property.$id}
                            </Link>
                        ) : (
                            "(Propiedad)"
                        )}
                    </span>
                    <span className="qualifier-value">
                        {value_relation ? (
                            <Link href={`/entity/${value_relation.$id}`}>
                                {value_relation.label || value_relation.$id}
                            </Link>
                        ) : parsedValue ? (
                            <ValueRenderer value={parsedValue} compact />
                        ) : (
                            "(Sin valor)"
                        )}
                    </span>

                    {editable && (
                        <div className="qualifier-actions">
                            <button
                                type="button"
                                className="btn-icon-sm btn-edit"
                                onClick={() => setShowEditForm(true)}
                                title="Editar calificador"
                            >
                                ✎
                            </button>
                            <button
                                type="button"
                                className="btn-icon-sm btn-edit"
                                onClick={() => setShowPermissions(true)}
                                title="Permisos"
                            >
                                🔐
                            </button>
                            <button
                                type="button"
                                className="btn-icon-sm btn-delete"
                                onClick={() => setShowDeleteConfirm(true)}
                                title="Eliminar calificador"
                            >
                                🗑
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div style={{ width: '100%' }}>
                    <InlineClaimForm
                        initialData={qualifier}
                        loading={saving}
                        onCancel={() => setShowEditForm(false)}
                        onSave={async (data) => {
                            setSaving(true);
                            try {
                                await onEdit?.(data, qualifier.$id, qualifier.claim);
                                setShowEditForm(false);
                            } finally {
                                setSaving(false);
                            }
                        }}
                        claimId={qualifier.claim}
                    />
                </div>
            )}

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title="Eliminar calificador"
                message="¿Estás seguro de que deseas eliminar este calificador?"
                loading={deleting}
            />

            <PermissionsModal
                isOpen={showPermissions}
                onClose={() => setShowPermissions(false)}
                title="Permisos del calificador"
                permissions={qualifier.$permissions || []}
                onSave={async (permissions) => {
                    await updateQualifierPermissions(qualifier.$id, permissions);
                }}
            />
        </div>
    );
}

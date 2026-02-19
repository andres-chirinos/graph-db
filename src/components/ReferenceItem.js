"use client";

import { useState } from "react";
import Link from "next/link";
import ReferenceForm from "./ReferenceForm";
import { ConfirmModal } from "./EditModal";
import PermissionsModal from "./PermissionsModal";
import { updateReferencePermissions } from "@/lib/database";
import "./ReferenceItem.css";

/**
 * Muestra una referencia
 */
export default function ReferenceItem({ reference, editable, onEdit, onDelete }) {
    const { details, reference: refEntity } = reference;
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [showPermissions, setShowPermissions] = useState(false);
    const [deleting, setDeleting] = useState(false);

    async function handleDelete() {
        setDeleting(true);
        try {
            await onDelete?.(reference.$id, reference.claim);
            setShowDeleteConfirm(false);
        } catch (e) {
            console.error("Error deleting reference:", e);
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div className="reference-item">
            {refEntity && (
                <Link href={`/entity/${refEntity.$id}`} className="reference-entity">
                    {refEntity.label || refEntity.$id}
                </Link>
            )}
            {details && <span className="reference-details">{details}</span>}

            {editable && (
                <div className="reference-actions">
                    <button
                        type="button"
                        className="btn-icon-sm btn-edit"
                        onClick={() => setShowEditForm(true)}
                        title="Editar referencia"
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
                        title="Eliminar referencia"
                    >
                        🗑
                    </button>
                </div>
            )}

            {showEditForm && (
                <ReferenceForm
                    isOpen={showEditForm}
                    onClose={() => setShowEditForm(false)}
                    onSave={async (data) => {
                        await onEdit?.(data, reference.$id, reference.claim);
                    }}
                    reference={reference}
                    claimId={reference.claim}
                />
            )}

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title="Eliminar referencia"
                message="¿Estás seguro de que deseas eliminar esta referencia?"
                loading={deleting}
            />

            <PermissionsModal
                isOpen={showPermissions}
                onClose={() => setShowPermissions(false)}
                title="Permisos de la referencia"
                permissions={reference.$permissions || []}
                onSave={async (permissions) => {
                    await updateReferencePermissions(reference.$id, permissions);
                }}
            />
        </div>
    );
}

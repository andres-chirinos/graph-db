"use client";

import { useState } from "react";
import ClaimItem from "./ClaimItem";
import ClaimForm from "./ClaimForm";

/**
 * Lista de claims agrupados por propiedad
 */
export default function ClaimsList({ 
  claims = [], 
  subjectId,
  editable = false,
  onClaimCreate,
  onClaimUpdate,
  onClaimDelete,
  onQualifierCreate,
  onQualifierUpdate,
  onQualifierDelete,
  onReferenceCreate,
  onReferenceUpdate,
  onReferenceDelete,
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingClaim, setEditingClaim] = useState(null);

  if (!claims || claims.length === 0) {
    return (
      <div className="claims-container">
        <div className="claims-empty">
          <span className="icon-info"></span>
          <p>Esta entidad no tiene declaraciones.</p>
        </div>
        {editable && (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAddForm(true)}
            >
              + Añadir declaración
            </button>
            {showAddForm && (
              <ClaimForm
                isOpen={showAddForm}
                onClose={() => setShowAddForm(false)}
                onSave={async (data) => {
                  await onClaimCreate?.(data);
                  setShowAddForm(false);
                }}
                subjectId={subjectId}
              />
            )}
          </>
        )}
      </div>
    );
  }

  // Agrupar claims por propiedad
  const groupedClaims = claims.reduce((acc, claim) => {
    const propertyId = claim.property?.$id || "unknown";
    if (!acc[propertyId]) {
      acc[propertyId] = {
        property: claim.property,
        claims: [],
      };
    }
    acc[propertyId].claims.push(claim);
    return acc;
  }, {});

  return (
    <div className="claims-container">
      <div className="claims-list">
        {Object.entries(groupedClaims).map(([propertyId, group]) => (
          <div key={propertyId} className="claims-group">
            <div className="claims-group-header">
              <span className="property-label">
                {group.property?.label || propertyId}
              </span>
            </div>
            <div className="claims-group-items">
              {group.claims.map((claim) => (
                <ClaimItem 
                  key={claim.$id} 
                  claim={claim}
                  editable={editable}
                  onEdit={(c) => setEditingClaim(c)}
                  onDelete={onClaimDelete}
                  onQualifierCreate={async (data) => {
                    await onQualifierCreate?.({ ...data, claim: claim.$id });
                  }}
                  onQualifierUpdate={onQualifierUpdate}
                  onQualifierDelete={onQualifierDelete}
                  onReferenceCreate={async (data) => {
                    await onReferenceCreate?.({ ...data, claim: claim.$id });
                  }}
                  onReferenceUpdate={onReferenceUpdate}
                  onReferenceDelete={onReferenceDelete}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {editable && (
        <div className="claims-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddForm(true)}
          >
            + Añadir declaración
          </button>
        </div>
      )}

      {/* Modal para nueva declaración */}
      {showAddForm && (
        <ClaimForm
          isOpen={showAddForm}
          onClose={() => setShowAddForm(false)}
          onSave={async (data) => {
            await onClaimCreate?.(data);
            setShowAddForm(false);
          }}
          subjectId={subjectId}
        />
      )}

      {/* Modal para editar declaración */}
      {editingClaim && (
        <ClaimForm
          isOpen={!!editingClaim}
          onClose={() => setEditingClaim(null)}
          onSave={async (data, claimId) => {
            await onClaimUpdate?.(data, claimId);
            setEditingClaim(null);
          }}
          claim={editingClaim}
          subjectId={subjectId}
        />
      )}
    </div>
  );
}

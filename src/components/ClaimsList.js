"use client";

import { useState } from "react";
import ClaimItem from "./ClaimItem";
import ClaimForm from "./ClaimForm";
import EntitySelector from "./EntitySelector";
import InlineClaimForm from "./InlineClaimForm";

/**
 * Lista de claims agrupados por propiedad con filtros y paginación
 */
export default function ClaimsList({
  claims = [],
  loading = false,
  page = 1,
  limit = 10,
  total = 0,
  onPageChange,
  filters = {},
  onFilterChange,
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

  const totalPages = Math.ceil(total / limit);

  const handleFilterPropertyChange = (propertyId) => {
    onFilterChange?.({ ...filters, property: propertyId });
  };

  const handleFilterValueChange = (e) => {
    onFilterChange?.({ ...filters, value: e.target.value });
  };

  return (
    <div className="claims-container">
      {/* Filter Bar */}
      <div className="claims-filter-bar">
        <div className="filter-group">
          <EntitySelector
            value={filters.property}
            onChange={handleFilterPropertyChange}
            placeholder="Filtrar por propiedad..."
            className="filter-property-selector"
          />
        </div>
        <div className="filter-group">
          <input
            type="text"
            className="filter-input"
            placeholder="Filtrar por valor..."
            value={filters.value || ""}
            onChange={handleFilterValueChange}
          />
        </div>
        {(filters.property || filters.value) && (
          <button
            className="btn-clear-filters"
            onClick={() => onFilterChange?.({ property: null, value: "" })}
            title="Limpiar filtros"
          >
            ✕
          </button>
        )}
      </div>

      {loading ? (
        <div className="claims-loading">
          <div className="spinner"></div>
          <p>Cargando declaraciones...</p>
        </div>
      ) : (!claims || claims.length === 0) ? (
        <div className="claims-empty">
          <span className="icon-info"></span>
          <p>No se encontraron declaraciones.</p>
        </div>
      ) : (
        <div className="claims-list">
          {Object.entries(groupByProperty(claims)).map(([propertyId, group]) => (
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
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="claims-pagination">
          <button
            className="btn-page"
            disabled={page <= 1}
            onClick={() => onPageChange?.(page - 1)}
          >
            Anterior
          </button>
          <span className="page-info">
            Página {page} de {totalPages}
          </span>
          <button
            className="btn-page"
            disabled={page >= totalPages}
            onClick={() => onPageChange?.(page + 1)}
          >
            Siguiente
          </button>
        </div>
      )}

      {editable && !showAddForm && (
        <div className="claims-actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddForm(true)}
          >
            + Añadir declaración
          </button>
        </div>
      )}

      {/* Formulario en línea para nueva declaración */}
      {showAddForm && (
        <InlineClaimForm
          onCancel={() => setShowAddForm(false)}
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

// Helper to group claims
function groupByProperty(claims) {
  return claims.reduce((acc, claim) => {
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
}

"use client";

import { useState } from "react";
import ClaimItem from "./ClaimItem";
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
  const [formVisibleForProperty, setFormVisibleForProperty] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");

  const totalPages = Math.ceil(total / limit);

  const groupedClaims = groupByProperty(claims);
  const filteredSidebarGroups = Object.entries(groupedClaims).filter(([propertyId, group]) => {
    const label = (group.property?.label || propertyId).toLowerCase();
    return label.includes(sidebarSearch.toLowerCase());
  });

  const handleFilterPropertyChange = (propertyId) => {
    onFilterChange?.({ ...filters, property: propertyId });
  };

  const handleFilterValueChange = (e) => {
    onFilterChange?.({ ...filters, value: e.target.value });
  };

  return (
    <div className="claims-container">

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
        <div className="claims-layout">
          {/* Index Sidebar Toggle */}
          <button
            type="button"
            className={`claims-index-toggle ${isSidebarOpen ? "open" : "closed"}`}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title="Índice de propiedades"
          >
            {isSidebarOpen ? "◀ Índice" : "▶ Índice"}
          </button>

          {/* Index Sidebar */}
          <div className={`claims-index-sidebar ${isSidebarOpen ? "open" : "closed"}`}>
            <h3 className="claims-index-title">Propiedades</h3>

            <div className="claims-index-search">
              <input
                type="text"
                placeholder="Buscar propiedad..."
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="filter-input"
                style={{ marginBottom: '1rem', width: '100%' }}
              />
            </div>

            <ul className="claims-index-list">
              {filteredSidebarGroups.map(([propertyId, group]) => (
                <li key={`nav-${propertyId}`}>
                  <a
                    href={`#property-${propertyId}`}
                    className="claims-index-link"
                    onClick={() => {
                      // Opcionalmente cerrar el sidebar al hacer clic en móvil (comentado por ahora)
                      // setIsSidebarOpen(false);
                    }}
                  >
                    {group.property?.label || propertyId}
                    <span className="claims-count">{group.claims.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Main Claims List */}
          <div className="claims-list">
            {Object.entries(groupedClaims).map(([propertyId, group]) => (
              <div key={propertyId} id={`property-${propertyId}`} className="claims-group">
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
                      onEdit={onClaimUpdate}
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

                  {editable && (
                    <div className="claims-group-actions" style={{ marginTop: '0.5rem' }}>
                      {formVisibleForProperty === propertyId ? (
                        <InlineClaimForm
                          initialData={{ property: group.property || { $id: propertyId } }}
                          onCancel={() => setFormVisibleForProperty(null)}
                          onSave={async (data) => {
                            await onClaimCreate?.(data);
                            setFormVisibleForProperty(null);
                          }}
                          subjectId={subjectId}
                        />
                      ) : (
                        <button
                          type="button"
                          className="btn-add-inline"
                          onClick={() => setFormVisibleForProperty(propertyId)}
                        >
                          + Añadir valor
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
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

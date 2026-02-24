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
  hasMore = false,
  onLoadMore,
  claimPropertiesSummary = null,
  onRequirePropertyLoad,
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
  const [formVisibleForProperty, setFormVisibleForProperty] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [localLoadingProps, setLocalLoadingProps] = useState(new Set());

  // Merge summary and loaded claims
  const allGroups = {};

  if (claimPropertiesSummary) {
    for (const [propId, summary] of Object.entries(claimPropertiesSummary)) {
      allGroups[propId] = {
        property: summary.property,
        claims: [],
        count: summary.count
      };
    }
  }

  for (const claim of claims) {
    const propId = claim.property?.$id || "unknown";
    if (!allGroups[propId]) {
      allGroups[propId] = {
        property: claim.property,
        claims: [],
        count: 0
      };
    }
    if (!allGroups[propId].claims.find(c => c.$id === claim.$id)) {
      allGroups[propId].claims.push(claim);
    }
  }

  // Sort groups alphabetically
  const sortedGroupEntries = Object.entries(allGroups).sort((a, b) => {
    const labelA = a[1].property?.label || a[0];
    const labelB = b[1].property?.label || b[0];
    return labelA.localeCompare(labelB);
  });

  const filteredSidebarGroups = sortedGroupEntries.filter(([propertyId, group]) => {
    const label = (group.property?.label || propertyId).toLowerCase();
    return label.includes(sidebarSearch.toLowerCase());
  });

  const handleIndexClick = async (e, propertyId, group) => {
    const loadedCount = group.claims.length;
    const totalCount = group.count ?? 0;

    // If not all claims are loaded for this property, load them specifically
    if (loadedCount < totalCount) {
      e.preventDefault();
      if (!localLoadingProps.has(propertyId)) {
        setLocalLoadingProps(prev => new Set(prev).add(propertyId));
        await onRequirePropertyLoad?.(propertyId);
        setLocalLoadingProps(prev => {
          const next = new Set(prev);
          next.delete(propertyId);
          return next;
        });
      }
      setTimeout(() => {
        document.getElementById(`property-${propertyId}`)?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

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
                    onClick={(e) => handleIndexClick(e, propertyId, group)}
                  >
                    {group.property?.label || propertyId}
                    {localLoadingProps.has(propertyId) ? (
                      <span className="claims-count loading-spin">...</span>
                    ) : (
                      <span className="claims-count">{group.count ?? group.claims?.length ?? 0}</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Main Claims List */}
          <div className="claims-list">
            {sortedGroupEntries.map(([propertyId, group]) => (
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

      {/* Load More Controls */}
      {hasMore && (
        <div className="claims-pagination">
          <button
            className="btn-page"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Cargar más declaraciones"}
          </button>
        </div>
      )}

    </div>
  );
}



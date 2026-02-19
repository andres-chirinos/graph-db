"use client";

import { useState, useEffect } from "react";
import RelationshipItem from "./RelationshipItem";
import { LoadingState, ErrorState } from "@/components"; // Assuming these are exported from index.js or similar
import { getClaimsByValueRelation, getClaimsByProperty, getReferencesByEntityRole, getClaim } from "@/lib/database";
import { getQualifiersByEntityRole } from "@/lib/db-qualifiers"; // Direct import to avoid circular dependency issues if index isn't updated
import "./RelationshipsView.css";

export default function RelationshipsView({
    entityId,
    type = "incoming", // incoming, property, references
    title,
    icon = "icon-list"
}) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filter, setFilter] = useState("");
    const pageSize = 5;

    useEffect(() => {
        fetchData();
    }, [entityId, type, page, filter]);

    async function fetchData() {
        setLoading(true);
        setError(null);
        try {
            let result;
            const offset = (page - 1) * pageSize;
            const options = {
                limit: pageSize,
                offset,
                filters: {} // Add specific filters here if needed based on `filter` state
            };

            if (filter) {
                // Simple client-side filtering logic for now if API doesn't support complex search
                // OR better: pass filter to API if supported.
                // For now, let's assume specific filters:
                // incoming/property -> filter by property name? Not easy without join.
                // Let's rely on what we implemented in db-*.js:
                // incoming: filters.property (ID), filters.subject (ID), filters.value (text)
                // property: filters.subject (ID), filters.value
                // reference: filters.claim
                // The user request "filtrar" implies a text search.
                // Since we don't have deep search, we might need to fetch more and filter client side
                // OR warn user that filtering is limited.
                // Let's try to implement a text filter if possible, or just property ID if formatted.
                // For this iteration, let's assume 'filter' is a property ID or value string if applicable.
                // To make it user friendly, we'd need a search box that resolves names to IDs.
                // For now, let's just pass `filter` as `value` for search if it makes sense.

                if (type === "incoming" || type === "property") {
                    options.filters.value = filter; // Search in value_raw
                }
            }

            let dataPoints = [];
            let total = 0;

            if (type === "incoming") {
                result = await getClaimsByValueRelation(entityId, options);
                dataPoints = result?.claims || [];
                total = result?.total || 0;
            } else if (type === "property") {
                result = await getClaimsByProperty(entityId, options);
                dataPoints = result?.claims || [];
                total = result?.total || 0;
            } else if (type === "references") {
                result = await getReferencesByEntityRole(entityId, options);
                if (result?.references?.length > 0) {
                    const claimIds = [...new Set(result.references.map(r => {
                        if (!r.claim) return null;
                        return typeof r.claim === 'object' ? r.claim.$id : r.claim;
                    }).filter(Boolean))];
                    if (claimIds.length > 0) {
                        dataPoints = await Promise.all(claimIds.map(id => getClaim(id)));
                    }
                }
                total = result?.total || 0;
            } else if (type === "qualifier_property" || type === "qualifier_value") {
                const role = type === "qualifier_property" ? "property" : "value";
                result = await getQualifiersByEntityRole(entityId, { ...options, role });

                if (result?.qualifiers?.length > 0) {
                    // Similar to references, show the CLAIM that has this qualifier
                    const claimIds = [...new Set(result.qualifiers.map(q => {
                        if (!q.claim) return null;
                        return typeof q.claim === 'object' ? q.claim.$id : q.claim;
                    }).filter(Boolean))];

                    if (claimIds.length > 0) {
                        dataPoints = await Promise.all(claimIds.map(id => getClaim(id)));
                        // Important: We might want to highlight *which* qualifier matched?
                        // For now, listing the claims is a good first step.
                    }
                }
                total = result?.total || 0;
            }

            setItems(dataPoints);
            setTotalPages(Math.ceil(total / pageSize));

        } catch (err) {
            console.error("Error fetching relationships:", err);
            setError("Error al cargar datos.");
        } finally {
            setLoading(false);
        }
    }

    const handlePrevPage = () => {
        if (page > 1) setPage(p => p - 1);
    };

    const handleNextPage = () => {
        if (page < totalPages) setPage(p => p + 1);
    };

    // Simple text filter input
    const handleFilterChange = (e) => {
        setFilter(e.target.value);
        setPage(1); // Reset to first page on filter change
    };

    if (!items.length && !loading && !filter) return null; // Hide section if empty? Or show "None"?

    return (
        <section className={`relationships-section ${type}`}>
            <div className="section-header">
                <h2 className="section-title">
                    <span className={icon}></span>
                    {title}
                </h2>
                {/* Filter Input */}
                <div className="filter-container">
                    <input
                        type="text"
                        placeholder="Filtrar por valor..."
                        value={filter}
                        onChange={handleFilterChange}
                        className="filter-input"
                    />
                </div>
            </div>

            {loading ? (
                <div className="loading-indicator">Cargando...</div>
            ) : error ? (
                <div className="error-message">{error}</div>
            ) : items.length === 0 ? (
                <p className="no-data">No se encontraron resultados.</p>
            ) : (
                <div className="relationships-list">
                    {items.map(claim => (
                        <RelationshipItem
                            key={claim.$id}
                            claim={claim}
                            type={type}
                            currentEntityId={entityId}
                        />
                    ))}
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="pagination-controls">
                    <button
                        disabled={page === 1}
                        onClick={handlePrevPage}
                        className="btn-pagination"
                    >
                        Anterior
                    </button>
                    <span className="page-info">
                        Página {page} de {totalPages}
                    </span>
                    <button
                        disabled={page === totalPages}
                        onClick={handleNextPage}
                        className="btn-pagination"
                    >
                        Siguiente
                    </button>
                </div>
            )}
        </section>
    );
}

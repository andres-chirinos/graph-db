"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { searchEntities } from "@/lib/database";

/**
 * Selector de entidades con búsqueda
 * Permite buscar y seleccionar una entidad existente
 */
import "./EntitySelector.css";

/**
 * Selector de entidades con búsqueda
 * Permite buscar y seleccionar una entidad existente
 */
export default function EntitySelector({
  value,
  onChange,
  placeholder = "Buscar entidad...",
  label,
  required = false,
  disabled = false,
  excludeIds = [],
  className = "",
  dropdownFooter = null,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const pageSize = 10;
  const containerRef = useRef(null);
  const searchTimeout = useRef(null);
  const isMounted = useRef(true);

  // Memoizar excludeIds para evitar re-renders infinitos
  const excludeIdsKey = useMemo(() => excludeIds.join(","), [excludeIds]);

  // Cleanup al desmontar
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  // Cargar entidad seleccionada si viene un ID
  useEffect(() => {
    let cancelled = false;

    async function loadEntity() {
      if (value && typeof value === "object") {
        if (!cancelled) setSelectedEntity(value);
      } else if (value && typeof value === "string") {
        try {
          const { getEntity } = await import("@/lib/database");
          const entity = await getEntity(value, false);
          if (!cancelled && isMounted.current) {
            setSelectedEntity(entity);
          }
        } catch (e) {
          if (!cancelled && isMounted.current) {
            setSelectedEntity({ $id: value, label: value });
          }
        }
      } else {
        if (!cancelled) setSelectedEntity(null);
      }
    }

    loadEntity();

    return () => {
      cancelled = true;
    };
  }, [value]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function normalizeText(text) {
    return String(text || "").toLowerCase().trim();
  }

  function rankEntity(entity, term) {
    const termNorm = normalizeText(term);
    if (!termNorm) return 0;
    const label = normalizeText(entity.label || "");
    const aliases = Array.isArray(entity.aliases)
      ? entity.aliases.map((a) => normalizeText(a))
      : [];
    const desc = normalizeText(entity.description || "");

    if (label === termNorm) return 100;
    if (aliases.includes(termNorm)) return 95;
    if (label.startsWith(termNorm)) return 80;
    if (aliases.some((a) => a.startsWith(termNorm))) return 75;
    if (label.includes(termNorm)) return 60;
    if (aliases.some((a) => a.includes(termNorm))) return 55;
    if (desc.includes(termNorm)) return 40;
    if (normalizeText(entity.$id).includes(termNorm)) return 30;
    return 0;
  }

  function mergeUniqueEntities(existing, next) {
    const map = new Map(existing.map((item) => [item.$id, item]));
    next.forEach((item) => map.set(item.$id, item));
    return Array.from(map.values());
  }

  async function searchEntitiesPage(term, nextPage = 0) {
    const trimmed = term.trim();
    if (trimmed.length < 2) return { rows: [], total: 0 };
    const offset = nextPage * pageSize;

    // Use searchEntities directly as it handles sorting by relevance and pagination
    const result = await searchEntities(trimmed, pageSize, offset);

    console.debug(result);

    return {
      rows: result?.rows || [],
      total: result?.total || 0
    };
  }

  async function trySearchById(term) {
    const normalized = term.trim();
    if (!normalized) return null;
    if (!/^[a-zA-Z0-9]{18,}$/.test(normalized)) return null;
    try {
      const { getEntity } = await import("@/lib/database");
      const entity = await getEntity(normalized, false);
      return entity || null;
    } catch {
      return null;
    }
  }

  // Búsqueda con debounce
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setPage(0);
      setHasMore(false);
      setTotal(0);
      return;
    }

    let cancelled = false;

    searchTimeout.current = setTimeout(async () => {
      if (!isMounted.current || cancelled) return;

      setLoading(true);
      try {
        const result = await searchEntitiesPage(trimmed, 0);
        if (!isMounted.current || cancelled) return;

        const rows = result.rows;
        const totalCount = result.total;

        const excludeSet = new Set(excludeIdsKey.split(",").filter(Boolean));
        let filtered = rows.filter((entity) => !excludeSet.has(entity.$id));

        // Note: ranking is done by backend now in searchEntities

        setResults(filtered);
        setPage(0);
        setTotal(totalCount);
        setHasMore(totalCount > pageSize); // Basic check, better logic might be needed
      } catch (e) {
        console.error("Error searching entities:", e);
        if (isMounted.current && !cancelled) {
          setResults([]);
          setPage(0);
          setHasMore(false);
          setTotal(0);
        }
      } finally {
        if (isMounted.current && !cancelled) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchTerm, excludeIdsKey]);

  const changePage = useCallback(async (newPage) => {
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) return;

    setLoading(true);
    try {
      const result = await searchEntitiesPage(trimmed, newPage);
      const rows = result.rows;
      const totalCount = result.total;

      const excludeSet = new Set(excludeIdsKey.split(",").filter(Boolean));
      let filtered = rows.filter((entity) => !excludeSet.has(entity.$id));

      // Note: ranking is done by backend now in searchEntities

      setResults(filtered);
      setPage(newPage);
      setTotal(totalCount);
      setHasMore(totalCount > (newPage + 1) * pageSize);
    } catch (e) {
      console.error("Error changing page:", e);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, excludeIdsKey]);

  function handleSelect(entity) {
    // If onChange is used for navigation, it might not need to set selectedEntity
    // We check if the parent component clears the value (e.g. Navigation) by passing null/undefined
    // In that case, we keep the component in "search mode" but call onChange

    onChange(entity.$id);

    // Only set selected state if value is being managed (not pure navigation)
    // Actually, setting selectedEntity locally is fine, if the parent resets `value` prop to null, 
    // the useEffect[value] loop will handle clearing it.
    // However, for pure navigation, we might want to close the dropdown immediately.
    setIsOpen(false);
    setSearchTerm("");
  }

  function handleClear() {
    setSelectedEntity(null);
    onChange(null);
    setSearchTerm("");
  }

  return (
    <div className={`entity-selector ${className}`} ref={containerRef}>
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}

      {selectedEntity ? (
        <div className="entity-selected">
          <div className="entity-selected-info">
            <span className="entity-selected-label">
              {selectedEntity.label || "(Sin etiqueta)"}
            </span>
            <span className="entity-selected-id">ID: {selectedEntity.$id}</span>
          </div>
          {!disabled && (
            <button
              type="button"
              className="entity-selected-clear"
              onClick={handleClear}
              aria-label="Limpiar selección"
            >
              ✕
            </button>
          )}
        </div>
      ) : (
        <div className="entity-search-wrapper">
          <input
            type="text"
            className="form-input"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            disabled={disabled}
            required={required && !selectedEntity}
          />

          {isOpen && (searchTerm.length >= 2 || loading) && (
            <div className="entity-search-dropdown">
              {loading ? (
                <div className="entity-search-loading">Buscando...</div>
              ) : results.length > 0 ? (
                <>
                  <ul className="entity-search-results">
                    {results.map((entity) => (
                      <li key={entity.$id}>
                        <button
                          type="button"
                          className="entity-search-result"
                          onClick={() => handleSelect(entity)}
                        >
                          <div className="result-header">
                            <span className="result-label">
                              {entity.label || "(Sin etiqueta)"}
                            </span>
                            <span className="result-id">#{entity.$id}</span>
                          </div>
                          {entity.description && (
                            <span className="result-description">
                              {entity.description}
                            </span>
                          )}
                          {entity.aliases && entity.aliases.length > 0 && (
                            <span className="result-aliases">
                              Alias: {entity.aliases.join(", ")}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="entity-search-pagination">
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => changePage(page - 1)}
                      disabled={page === 0 || loading}
                    >
                      Anterior
                    </button>
                    <span className="pagination-info">
                      {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} de {total}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => changePage(page + 1)}
                      disabled={!hasMore || loading}
                    >
                      Siguiente
                    </button>
                  </div>
                </>
              ) : searchTerm.length >= 2 ? (
                <div className="entity-search-empty">
                  No se encontraron entidades
                </div>
              ) : null}

              {/* Render Footer if exists (even if no results, or searching) */}
              {dropdownFooter && (
                <div className="entity-search-footer">
                  {dropdownFooter}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

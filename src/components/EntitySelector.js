"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { searchEntities } from "@/lib/database";

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
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const containerRef = useRef(null);
  const searchTimeout = useRef(null);
  const isMounted = useRef(true);

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

  // Búsqueda con debounce
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (searchTerm.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;

    searchTimeout.current = setTimeout(async () => {
      if (!isMounted.current || cancelled) return;
      
      setLoading(true);
      try {
        const result = await searchEntities(searchTerm, 10);
        if (!isMounted.current || cancelled) return;
        
        // Verificar que el resultado tenga rows
        const rows = result?.rows || [];
        // Filtrar entidades excluidas
        const filtered = rows.filter(
          (entity) => !excludeIds.includes(entity.$id)
        );
        setResults(filtered);
      } catch (e) {
        console.error("Error searching entities:", e);
        if (isMounted.current && !cancelled) {
          setResults([]);
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
  }, [searchTerm, excludeIds]);

  function handleSelect(entity) {
    setSelectedEntity(entity);
    onChange(entity.$id);
    setIsOpen(false);
    setSearchTerm("");
  }

  function handleClear() {
    setSelectedEntity(null);
    onChange(null);
    setSearchTerm("");
  }

  return (
    <div className="entity-selector" ref={containerRef}>
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}

      {selectedEntity ? (
        <div className="entity-selected">
          <div className="entity-selected-info">
            <span className="entity-selected-id">{selectedEntity.$id}</span>
            <span className="entity-selected-label">
              {selectedEntity.label || "(Sin etiqueta)"}
            </span>
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
                <ul className="entity-search-results">
                  {results.map((entity) => (
                    <li key={entity.$id}>
                      <button
                        type="button"
                        className="entity-search-result"
                        onClick={() => handleSelect(entity)}
                      >
                        <span className="result-id">{entity.$id}</span>
                        <span className="result-label">
                          {entity.label || "(Sin etiqueta)"}
                        </span>
                        {entity.description && (
                          <span className="result-description">
                            {entity.description}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : searchTerm.length >= 2 ? (
                <div className="entity-search-empty">
                  No se encontraron entidades
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SearchBar, EntityCard, LoadingState, EmptyState, ErrorState, EntitySelector } from "@/components";
import { searchEntities, searchEntitiesBySchema } from "@/lib/database";
import "./style.css";

export default function SearchPage() {
  return (
    <div className="explorer-layout">
      <main className="explorer-main">
        <div className="explorer-container">
          <Suspense fallback={<LoadingState message="Cargando búsqueda..." />}>
            <SearchContent />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

function SearchContent() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSummary, setSearchSummary] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced Search State
  const [advancedText, setAdvancedText] = useState("");
  const [logic, setLogic] = useState("AND");
  const [advancedConditions, setAdvancedConditions] = useState([]);

  const searchParams = useSearchParams();

  useEffect(() => {
    const queryParam = searchParams.get("q") || "";
    const mode = searchParams.get("mode");
    if (mode === "advanced") {
      setShowAdvanced(true);
    }

    if (queryParam && queryParam !== searchQuery) {
      setSearchQuery(queryParam);
      setAdvancedText(queryParam);
      handleSearch(queryParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleSearch(query) {
    setSearchQuery(query);
    setLoading(true);
    setError(null);
    setHasSearched(true);
    setSearchSummary(query);
    try {
      const result = await searchEntities(query, 50);
      setResults(result.rows);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  function addAdvancedCondition() {
    setAdvancedConditions((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), propertyId: null, value: "", matchMode: "contains" },
    ]);
  }

  function updateAdvancedCondition(id, updates) {
    setAdvancedConditions((prev) =>
      prev.map((condition) =>
        condition.id === id ? { ...condition, ...updates } : condition
      )
    );
  }

  function removeAdvancedCondition(id) {
    setAdvancedConditions((prev) => prev.filter((condition) => condition.id !== id));
  }

  async function handleAdvancedSearch() {
    setLoading(true);
    setError(null);
    setHasSearched(true);

    const properties = advancedConditions
      .filter((condition) => condition.propertyId && condition.value?.trim())
      .map((condition) => ({
        propertyId: condition.propertyId,
        value: condition.value,
        matchMode: condition.matchMode || "contains",
      }));

    const schema = {
      text: advancedText,
      properties,
      logic,
    };

    const summaryParts = [];
    if (advancedText?.trim()) summaryParts.push(`texto: "${advancedText.trim()}"`);
    if (properties.length > 0) {
      summaryParts.push(`${properties.length} condición${properties.length !== 1 ? "es" : ""} (${logic})`);
    }
    setSearchSummary(summaryParts.length > 0 ? summaryParts.join(" · ") : "Búsqueda avanzada");

    try {
      // Use the schema search directly
      const result = await searchEntitiesBySchema(schema, 50);
      setResults(result || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Búsqueda Avanzada</h1>
        <p className="page-subtitle">
          Busca entidades por etiqueta, descripción, alias o propiedades específicas
        </p>
      </header>

      <section className="search-section">
        <SearchBar
          onSearch={handleSearch}
          placeholder="Escribe tu búsqueda..."
          initialQuery={searchQuery}
          onQueryChange={(value) => setSearchQuery(value)}
        />
        <div className="advanced-toggle">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowAdvanced((prev) => !prev)}
          >
            {showAdvanced ? "Ocultar opciones avanzadas" : "Mostrar opciones avanzadas"}
          </button>
        </div>
      </section>

      {showAdvanced && (
        <section className="advanced-section">
          <h2 className="section-title">Configuración de búsqueda</h2>

          <div className="advanced-grid">
            <div className="form-group">
              <label>Texto (label, descripción o alias)</label>
              <input
                type="text"
                value={advancedText}
                onChange={(e) => setAdvancedText(e.target.value)}
                placeholder="Ej: Municipalidad"
                className="form-input"
              />
            </div>
          </div>

          <div className="advanced-conditions">
            <div className="conditions-header">
              <div className="conditions-title-group">
                <h3>Condiciones por Propiedad</h3>
                <div className="logic-toggle">
                  <span className="logic-label">Lógica:</span>
                  <div className="btn-group">
                    <button
                      type="button"
                      className={`btn btn-sm ${logic === "AND" ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setLogic("AND")}
                    >
                      AND (Todas)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${logic === "OR" ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setLogic("OR")}
                    >
                      OR (Alguna)
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={addAdvancedCondition}
              >
                + Añadir condición
              </button>
            </div>

            {advancedConditions.length === 0 ? (
              <div className="conditions-empty">
                Agrega condiciones para filtrar por propiedades específicas.
              </div>
            ) : (
              <div className="conditions-list">
                {advancedConditions.map((condition, index) => (
                  <div key={condition.id} className="condition-row">
                    {index > 0 && (
                      <span className={`condition-pill ${logic.toLowerCase()}`}>
                        {logic}
                      </span>
                    )}
                    <div className="condition-field property-field">
                      <label>Propiedad</label>
                      <EntitySelector
                        value={condition.propertyId}
                        onChange={(value) => updateAdvancedCondition(condition.id, { propertyId: value })}
                        placeholder="Buscar propiedad..."
                        className="condition-selector"
                      />
                    </div>
                    <div className="condition-field operator-field">
                      <label>Operador</label>
                      <select
                        value={condition.matchMode || "contains"}
                        onChange={(e) => updateAdvancedCondition(condition.id, { matchMode: e.target.value })}
                        className="form-select"
                      >
                        <option value="contains">Contiene</option>
                        <option value="equal">Igual</option>
                      </select>
                    </div>
                    <div className="condition-field value-field">
                      <label>Valor</label>
                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) => updateAdvancedCondition(condition.id, { value: e.target.value })}
                        placeholder="Valor a buscar"
                        disabled={!condition.propertyId}
                        className="form-input"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-remove-condition"
                      onClick={() => removeAdvancedCondition(condition.id)}
                      title="Eliminar condición"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="advanced-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAdvancedSearch}
              disabled={loading}
            >
              {loading ? "Buscando..." : "Ejecutar Búsqueda Avanzada"}
            </button>
          </div>
        </section>
      )}

      <section className="results-section">
        {loading ? (
          <LoadingState message="Buscando entidades..." />
        ) : error ? (
          <ErrorState error={error} onRetry={() => handleSearch(searchQuery)} />
        ) : !hasSearched ? (
          <div className="search-prompt">
            <span className="icon-search prompt-icon"></span>
            <p>Ingresa un término para buscar entidades</p>
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            title="Sin resultados"
            message={`No se encontraron entidades para "${searchSummary || searchQuery}"`}
            icon="search"
          />
        ) : (
          <>
            <div className="results-header">
              <span className="results-count">
                {results.length} resultado{results.length !== 1 ? "s" : ""} para "{searchSummary || searchQuery}"
              </span>
            </div>
            <div className="entities-list">
              {results.map((entity) => (
                <EntityCard key={entity.$id} entity={entity} />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}

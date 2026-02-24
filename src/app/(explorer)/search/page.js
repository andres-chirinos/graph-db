"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EntityCard, LoadingState, EmptyState, ErrorState, EntitySelector } from "@/components";
import { searchEntities, searchEntitiesBySchema } from "@/lib/database";
import "./style.css";

const OPERATORS = [
  { value: "equal", label: "equal", type: "text" },
  { value: "notEqual", label: "notEqual", type: "text" },
  { value: "startsWith", label: "startsWith", type: "text" },
  { value: "endsWith", label: "endsWith", type: "text" },
  { value: "contains", label: "contains", type: "text" },
  { value: "greaterThan", label: "greaterThan", type: "numeric" },
  { value: "greaterThanEqual", label: "greaterThanEqual", type: "numeric" },
  { value: "lessThan", label: "lessThan", type: "numeric" },
  { value: "lessThanEqual", label: "lessThanEqual", type: "numeric" },
];

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

  // Advanced Search State - Grouping
  const [rootGroup, setRootGroup] = useState({
    id: "root",
    type: "group",
    logic: "AND",
    children: []
  });

  const searchParams = useSearchParams();

  useEffect(() => {
    const queryParam = searchParams.get("q") || "";
    // We don't need distinct 'mode' check anymore as UI is unified
    if (queryParam && queryParam !== searchQuery) {
      setSearchQuery(queryParam);
      // Trigger search only if there's a query
      handleSearch(queryParam);
    }
  }, [searchParams]);

  // Wrapper for simple text search (e.g. from URL or retry)
  async function handleSearch(query) {
    setSearchQuery(query);
    // Execute search with current tree + new query
    // We can't rely on state update immediately, so we pass query explicitly
    executeSearch(query, rootGroup);
  }

  // Recursive State Updaters
  const updateNode = (nodeId, updates) => {
    const recursiveUpdate = (node) => {
      if (node.id === nodeId) {
        return { ...node, ...updates };
      }
      if (node.children) {
        return { ...node, children: node.children.map(recursiveUpdate) };
      }
      return node;
    };
    setRootGroup((prev) => recursiveUpdate(prev));
  };

  const addCondition = (groupId) => {
    const targetId = groupId || "root"; // Default to root if no ID passed (e.g. main button)
    const newCondition = {
      id: Date.now() + Math.random(),
      type: "condition",
      propertyId: null,
      value: "",
      matchMode: "equal"
    };
    const recursiveAdd = (node) => {
      if (node.id === targetId) {
        return { ...node, children: [...node.children, newCondition] };
      }
      if (node.children) {
        return { ...node, children: node.children.map(recursiveAdd) };
      }
      return node;
    };
    setRootGroup((prev) => recursiveAdd(prev));
  };

  const addGroup = (groupId) => {
    const targetId = groupId || "root";
    const newGroup = {
      id: Date.now() + Math.random(),
      type: "group",
      logic: "OR",
      children: []
    };
    const recursiveAdd = (node) => {
      if (node.id === targetId) {
        return { ...node, children: [...node.children, newGroup] };
      }
      if (node.children) {
        return { ...node, children: node.children.map(recursiveAdd) };
      }
      return node;
    };
    setRootGroup((prev) => recursiveAdd(prev));
  };

  const removeNode = (nodeId) => {
    const recursiveRemove = (node) => {
      if (!node.children) return node;
      return {
        ...node,
        children: node.children
          .filter(child => child.id !== nodeId)
          .map(recursiveRemove)
      };
    };
    setRootGroup((prev) => recursiveRemove(prev));
  };

  // Main search execution
  async function handleAdvancedSearch() {
    await executeSearch(searchQuery, rootGroup);
  }

  async function executeSearch(textQuery, groupState) {
    setLoading(true);
    setError(null);
    setHasSearched(true);

    const buildSchema = (group) => {
      const properties = group.children
        .filter(c => c.type === 'condition' && c.propertyId)
        .map(c => ({
          propertyId: c.propertyId,
          value: c.value,
          matchMode: c.matchMode || "equal"
        }));

      const groups = group.children
        .filter(c => c.type === 'group')
        .map(buildSchema);

      return {
        logic: group.logic,
        properties,
        groups
      };
    };

    const rootSchema = buildSchema(groupState);
    const schema = {
      text: textQuery,
      ...rootSchema
    };

    // Update summary
    const summaryParts = [];
    if (textQuery?.trim()) summaryParts.push(`search("${textQuery.trim()}")`);

    const countConditions = (g) => g.children.length + g.children.filter(c => c.type === 'group').reduce((acc, child) => acc + countConditions(child), 0);
    const totalFilters = countConditions(groupState);

    if (totalFilters > 0) {
      summaryParts.push(`+ ${totalFilters} filtros`);
    }
    setSearchSummary(summaryParts.join(" "));

    try {
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

      <section className="search-interface">
        <div className="query-builder">
          {/* Main Search Row */}
          <div className="query-row primary-search-row">
            <div className="query-logic-label search-badge">SEARCH</div>
            <div className="query-content">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdvancedSearch()}
                placeholder="Buscar por texto (label, descripción...)"
                className="query-input main-query-input"
              />
            </div>
            <div className="query-actions-inline">
              <button
                type="button"
                className="btn-primary btn-search-action"
                onClick={handleAdvancedSearch}
                disabled={loading}
              >
                {loading ? "..." : "Buscar"}
              </button>
            </div>
          </div>

          {/* Root Group */}
          <div className="conditions-container root-container">
            <QueryGroup
              group={rootGroup}
              onUpdate={updateNode}
              onAddCondition={addCondition}
              onAddGroup={addGroup}
              onRemove={removeNode}
              isRoot={true}
            />
          </div>
        </div>
      </section>

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
                <EntityCard key={entity.$id} entity={entity} highlightQuery={searchQuery} />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}

function QueryGroup({ group, onUpdate, onAddCondition, onAddGroup, onRemove, isRoot }) {
  return (
    <div className={`query-group ${!isRoot ? "nested-group" : ""}`}>
      {!isRoot && <div className="group-connector-line"></div>}

      <div className="group-header">
        <div className="query-logic-connector">
          <select
            className="logic-select"
            value={group.logic}
            onChange={(e) => onUpdate(group.id, { logic: e.target.value })}
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
        </div>

        <div className="group-actions">
          <button
            type="button"
            className="btn-icon-action btn-sm"
            onClick={() => onAddCondition(group.id)}
          >
            + Filtro
          </button>
          <button
            type="button"
            className="btn-icon-action btn-sm"
            onClick={() => onAddGroup(group.id)}
          >
            + Grupo
          </button>
          {!isRoot && (
            <button
              type="button"
              className="btn-remove-condition"
              onClick={() => onRemove(group.id)}
              title="Eliminar grupo"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="group-children">
        {group.children.map((child) => (
          child.type === "group" ? (
            <QueryGroup
              key={child.id}
              group={child}
              onUpdate={onUpdate}
              onAddCondition={onAddCondition}
              onAddGroup={onAddGroup}
              onRemove={onRemove}
              isRoot={false}
            />
          ) : (
            <QueryCondition
              key={child.id}
              condition={child}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          )
        ))}
      </div>
    </div>
  );
}

function QueryCondition({ condition, onUpdate, onRemove }) {
  return (
    <div className="query-row condition-row">
      <div className="condition-connector-line"></div>
      <div className="query-content condition-grid">
        <div className="field-col">
          <EntitySelector
            value={condition.propertyId}
            onChange={(value) => onUpdate(condition.id, { propertyId: value })}
            placeholder="Atributo"
            className="attribute-selector"
          />
        </div>

        <div className="operator-col">
          <select
            value={condition.matchMode || "equal"}
            onChange={(e) => onUpdate(condition.id, { matchMode: e.target.value })}
            className="operator-select"
          >
            {OPERATORS.map(op => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
        </div>

        <div className="value-col">
          <input
            type="text"
            value={condition.value}
            onChange={(e) => onUpdate(condition.id, { value: e.target.value })}
            placeholder="Valor"
            className="value-input"
          />
        </div>

        <button
          type="button"
          className="btn-remove-condition"
          onClick={() => onRemove(condition.id)}
          title="Eliminar filtro"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

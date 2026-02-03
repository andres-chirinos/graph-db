"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navigation, SearchBar, EntityCard, LoadingState, EmptyState, ErrorState } from "@/components";
import { searchEntities } from "@/lib/database";

export default function SearchPage() {
  const router = useRouter();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  async function handleSearch(query) {
    setSearchQuery(query);
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const result = await searchEntities(query, 50);
      setResults(result.rows);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="explorer-layout">
      <Navigation />

      <main className="explorer-main">
        <div className="explorer-container">
          <header className="page-header">
            <h1 className="page-title">Búsqueda Avanzada</h1>
            <p className="page-subtitle">
              Busca entidades por etiqueta, descripción o alias
            </p>
          </header>

          <section className="search-section">
            <SearchBar
              onSearch={handleSearch}
              placeholder="Escribe tu búsqueda..."
            />
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
                message={`No se encontraron entidades para "${searchQuery}"`}
                icon="search"
              />
            ) : (
              <>
                <div className="results-header">
                  <span className="results-count">
                    {results.length} resultado{results.length !== 1 ? "s" : ""} para "{searchQuery}"
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
        </div>
      </main>

      <footer className="explorer-footer">
        <p>Graph DB Explorer</p>
      </footer>
    </div>
  );
}

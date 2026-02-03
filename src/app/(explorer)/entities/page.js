"use client";

import { useState, useEffect } from "react";
import { Navigation, EntityCard, LoadingState, ErrorState, EmptyState } from "@/components";
import { listEntities } from "@/lib/database";

const ITEMS_PER_PAGE = 25;

export default function EntitiesListPage() {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadEntities();
  }, [page]);

  async function loadEntities() {
    setLoading(true);
    setError(null);
    try {
      const result = await listEntities(ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
      setEntities(result.documents);
      setTotal(result.total);
      setHasMore(result.documents.length === ITEMS_PER_PAGE);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  function nextPage() {
    if (hasMore) {
      setPage((p) => p + 1);
    }
  }

  function prevPage() {
    if (page > 0) {
      setPage((p) => p - 1);
    }
  }

  return (
    <div className="explorer-layout">
      <Navigation />

      <main className="explorer-main">
        <div className="explorer-container">
          <header className="page-header">
            <h1 className="page-title">Todas las Entidades</h1>
            <p className="page-subtitle">
              Explorando {total} entidades en la base de datos
            </p>
          </header>

          {loading ? (
            <LoadingState message="Cargando entidades..." />
          ) : error ? (
            <ErrorState error={error} onRetry={loadEntities} />
          ) : entities.length === 0 ? (
            <EmptyState
              title="Sin entidades"
              message="No hay entidades en la base de datos todavía"
              icon="database"
            />
          ) : (
            <>
              <div className="entities-list">
                {entities.map((entity) => (
                  <EntityCard key={entity.$id} entity={entity} />
                ))}
              </div>

              {/* Pagination */}
              <nav className="pagination">
                <button
                  onClick={prevPage}
                  disabled={page === 0}
                  className="pagination-button"
                >
                  <span className="icon-chevron-left"></span>
                  Anterior
                </button>

                <span className="pagination-info">
                  Página {page + 1} de {Math.ceil(total / ITEMS_PER_PAGE)}
                </span>

                <button
                  onClick={nextPage}
                  disabled={!hasMore}
                  className="pagination-button"
                >
                  Siguiente
                  <span className="icon-chevron-right"></span>
                </button>
              </nav>
            </>
          )}
        </div>
      </main>

      <footer className="explorer-footer">
        <p>Graph DB Explorer — Basado en el modelo de Wikidata</p>
      </footer>
    </div>
  );
}

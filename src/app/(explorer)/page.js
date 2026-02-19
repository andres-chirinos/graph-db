"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EntitySelector, EntityCard, LoadingState, EmptyState, ErrorState } from "@/components";
import { listEntities } from "@/lib/database";
import "@/components/Stats.css";
import "./home.css";

export default function HomePage() {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    loadRecentEntities();
  }, []);

  async function loadRecentEntities() {
    setLoading(true);
    setError(null);
    try {
      const result = await listEntities(10, 0);
      setEntities(result.rows);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleEntitySelect(entityId) {
    if (entityId) {
      router.push(`/entity/${entityId}`);
    }
  }

  function handleAdvancedSearch() {
    router.push(`/search?mode=advanced`);
  }

  function handleViewAll() {
    router.push(`/search`);
  }

  const dropdownFooter = (
    <div className="nav-search-actions">
      <button
        type="button"
        className="nav-search-action"
        onClick={handleAdvancedSearch}
      >
        Búsqueda avanzada
      </button>
      <button
        type="button"
        className="nav-search-action"
        onClick={handleViewAll}
      >
        Ver todos los resultados
      </button>
    </div>
  );

  return (
    <div className="explorer-layout">
      <main className="explorer-main">
        <div className="explorer-container">
          {/* Hero Section */}
          <section className="hero-section">
            <h1 className="hero-title">Explorador de Entidades</h1>
            <p className="hero-subtitle">
              Base de conocimiento
            </p>

            <div className="hero-search-wrapper">
              <EntitySelector
                placeholder="Buscar entidades, propiedades, conceptos..."
                onChange={handleEntitySelect}
                dropdownFooter={dropdownFooter}
                value={null}
              />
            </div>
          </section>

          {/* Entities Section */}
          <section className="entities-section">
            <div className="section-header">
              <h2 className="section-title">
                Entidades recientes
              </h2>
              <Link href="/entities" className="view-all-link">
                Ver todas <span className="icon-arrow-right"></span>
              </Link>
            </div>

            {loading ? (
              <LoadingState message="Cargando entidades..." />
            ) : error ? (
              <ErrorState error={error} onRetry={loadRecentEntities} />
            ) : entities.length === 0 ? (
              <EmptyState
                title="Sin entidades"
                message="No hay entidades en la base de datos todavía"
                icon="database"
              />
            ) : (
              <div className="entities-grid">
                {entities.map((entity) => (
                  <EntityCard key={entity.$id} entity={entity} />
                ))}
              </div>
            )}
          </section>

          {/* Quick Stats */}
          <section className="stats-section">
            <h2 className="section-title">Estadísticas rápidas</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="icon-box stat-icon"></span>
                <div className="stat-content">
                  <span className="stat-value">{entities.length}+</span>
                  <span className="stat-label">Entidades</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

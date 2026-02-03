"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Navigation, EntityHeader, ClaimsList, LoadingState, ErrorState } from "@/components";
import { getEntity, getClaim } from "@/lib/database";

export default function EntityPage({ params }) {
  const { id } = use(params);
  const [entity, setEntity] = useState(null);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadEntity();
  }, [id]);

  async function loadEntity() {
    setLoading(true);
    setError(null);
    try {
      const entityData = await getEntity(id, true);
      setEntity(entityData);

      // Cargar detalles de cada claim (qualifiers y references)
      if (entityData.claims && entityData.claims.length > 0) {
        const claimsWithDetails = await Promise.all(
          entityData.claims.map((claim) => getClaim(claim.$id))
        );
        setClaims(claimsWithDetails);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="explorer-layout">
        <Navigation />
        <main className="explorer-main">
          <div className="explorer-container">
            <LoadingState message="Cargando entidad..." />
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="explorer-layout">
        <Navigation />
        <main className="explorer-main">
          <div className="explorer-container">
            <ErrorState
              error={error}
              title="Error al cargar entidad"
              onRetry={loadEntity}
            />
          </div>
        </main>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="explorer-layout">
        <Navigation />
        <main className="explorer-main">
          <div className="explorer-container">
            <ErrorState
              error="La entidad solicitada no existe"
              title="Entidad no encontrada"
            />
            <Link href="/" className="back-link">
              <span className="icon-arrow-left"></span>
              Volver al inicio
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="explorer-layout">
      <Navigation />

      <main className="explorer-main">
        <div className="explorer-container entity-page">
          {/* Breadcrumb */}
          <nav className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-separator">/</span>
            <Link href="/entities">Entidades</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{entity.label || entity.$id}</span>
          </nav>

          {/* Entity Header */}
          <EntityHeader entity={entity} />

          {/* Claims / Statements */}
          <section className="entity-statements">
            <h2 className="section-title">
              <span className="icon-list"></span>
              Declaraciones
            </h2>
            <ClaimsList claims={claims} />
          </section>

          {/* Related Entities Section */}
          {entity.claims_subject && entity.claims_subject.length > 0 && (
            <section className="entity-related">
              <h2 className="section-title">
                <span className="icon-link"></span>
                Usado como propiedad en
              </h2>
              <div className="related-list">
                {entity.claims_subject.slice(0, 10).map((claim) => (
                  <Link
                    key={claim.$id}
                    href={`/entity/${claim.subject?.$id}`}
                    className="related-item"
                  >
                    {claim.subject?.label || claim.subject?.$id}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="explorer-footer">
        <p>Graph DB Explorer — Basado en el modelo de Wikidata</p>
      </footer>
    </div>
  );
}

"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navigation, EntityHeader, ClaimsList, LoadingState, ErrorState } from "@/components";
import { 
  getEntity, 
  getClaim, 
  getClaimsByValueRelation, 
  getClaimsByProperty,
  updateEntity,
  deleteEntity,
  createClaim,
  updateClaim,
  deleteClaim,
  createQualifier,
  updateQualifier,
  deleteQualifier,
  createReference,
  updateReference,
  deleteReference,
} from "@/lib/database";

export default function EntityPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [entity, setEntity] = useState(null);
  const [claims, setClaims] = useState([]);
  const [incomingClaims, setIncomingClaims] = useState([]);
  const [usedAsProperty, setUsedAsProperty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // TODO: Obtener de AuthContext cuando la autenticación esté habilitada
  const editable = true;

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
      } else {
        setClaims([]);
      }

      // Cargar relaciones inversas (donde esta entidad es el valor)
      const incoming = await getClaimsByValueRelation(id);
      setIncomingClaims(incoming);

      // Cargar claims donde esta entidad es usada como propiedad
      const asProperty = await getClaimsByProperty(id);
      setUsedAsProperty(asProperty);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  // ==================== ENTITY HANDLERS ====================
  async function handleUpdateEntity(data) {
    await updateEntity(id, data);
    await loadEntity();
  }

  async function handleDeleteEntity() {
    await deleteEntity(id);
    router.push("/entities");
  }

  // ==================== CLAIM HANDLERS ====================
  async function handleCreateClaim(data) {
    await createClaim(data);
    await loadEntity();
  }

  async function handleUpdateClaim(data, claimId) {
    await updateClaim(claimId, data);
    await loadEntity();
  }

  async function handleDeleteClaim(claimId) {
    await deleteClaim(claimId);
    await loadEntity();
  }

  // ==================== QUALIFIER HANDLERS ====================
  async function handleCreateQualifier(data) {
    await createQualifier(data);
    await loadEntity();
  }

  async function handleUpdateQualifier(data, qualifierId) {
    await updateQualifier(qualifierId, data);
    await loadEntity();
  }

  async function handleDeleteQualifier(qualifierId) {
    await deleteQualifier(qualifierId);
    await loadEntity();
  }

  // ==================== REFERENCE HANDLERS ====================
  async function handleCreateReference(data) {
    await createReference(data);
    await loadEntity();
  }

  async function handleUpdateReference(data, referenceId) {
    await updateReference(referenceId, data);
    await loadEntity();
  }

  async function handleDeleteReference(referenceId) {
    await deleteReference(referenceId);
    await loadEntity();
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
          <EntityHeader 
            entity={entity}
            editable={editable}
            onUpdate={handleUpdateEntity}
            onDelete={handleDeleteEntity}
          />

          {/* Claims / Statements */}
          <section className="entity-statements">
            <h2 className="section-title">
              <span className="icon-list"></span>
              Declaraciones
            </h2>
            <ClaimsList 
              claims={claims}
              subjectId={id}
              editable={editable}
              onClaimCreate={handleCreateClaim}
              onClaimUpdate={handleUpdateClaim}
              onClaimDelete={handleDeleteClaim}
              onQualifierCreate={handleCreateQualifier}
              onQualifierUpdate={handleUpdateQualifier}
              onQualifierDelete={handleDeleteQualifier}
              onReferenceCreate={handleCreateReference}
              onReferenceUpdate={handleUpdateReference}
              onReferenceDelete={handleDeleteReference}
            />
          </section>

          {/* Incoming Relations - Where this entity is referenced as value */}
          {incomingClaims.length > 0 && (
            <section className="entity-incoming">
              <h2 className="section-title">
                <span className="icon-arrow-left"></span>
                Lo que enlaza aquí
              </h2>
              <p className="section-description">
                Entidades que hacen referencia a esta entidad
              </p>
              <div className="incoming-claims-list">
                {incomingClaims.map((claim) => (
                  <div key={claim.$id} className="incoming-claim-item">
                    <Link 
                      href={`/entity/${claim.subject?.$id}`} 
                      className="incoming-subject"
                    >
                      {claim.subject?.label || claim.subject?.$id}
                    </Link>
                    <span className="incoming-property">
                      {claim.property?.label || claim.property?.$id}
                    </span>
                    <span className="incoming-arrow">→</span>
                    <span className="incoming-value-self">
                      {entity.label || entity.$id}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Used as Property */}
          {usedAsProperty.length > 0 && (
            <section className="entity-as-property">
              <h2 className="section-title">
                <span className="icon-tag"></span>
                Usado como propiedad
              </h2>
              <p className="section-description">
                Declaraciones que usan esta entidad como propiedad
              </p>
              <div className="incoming-claims-list">
                {usedAsProperty.map((claim) => (
                  <div key={claim.$id} className="incoming-claim-item">
                    <Link 
                      href={`/entity/${claim.subject?.$id}`} 
                      className="incoming-subject"
                    >
                      {claim.subject?.label || claim.subject?.$id}
                    </Link>
                    <span className="incoming-property-self">
                      {entity.label || entity.$id}
                    </span>
                    <span className="incoming-arrow">→</span>
                    {claim.value_relation ? (
                      <Link 
                        href={`/entity/${claim.value_relation.$id}`}
                        className="incoming-value"
                      >
                        {claim.value_relation.label || claim.value_relation.$id}
                      </Link>
                    ) : (
                      <span className="incoming-value-raw">
                        {claim.value_raw || "(valor)"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="explorer-footer">
        <p>Graph DB Explorer</p>
      </footer>
    </div>
  );
}

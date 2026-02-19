"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EntityHeader, ClaimsList, LoadingState, ErrorState, RelationshipsView } from "@/components";
import { useAuth } from "@/context/AuthContext";
import {
  getEntity,
  getClaim,
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
import "./page.css";

export default function EntityPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, activeTeam, canEdit, canDelete, canCreate, loading: authLoading } = useAuth();

  const [entity, setEntity] = useState(null);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  // Permisos de edición basados en el contexto de autenticación
  const editable = canEdit || canCreate || canDelete;

  useEffect(() => {
    loadEntity();
  }, [id]);

  async function loadEntity() {
    setLoading(true);
    setError(null);
    setEntity(null);
    setClaims([]);
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
    const teamId = activeTeam?.$id || null;
    const newClaimRaw = await createClaim(data, teamId);
    const newClaim = await getClaim(newClaimRaw.$id); // Fetch fully expanded claim
    setClaims(prev => [...prev, newClaim]);
  }

  async function handleUpdateClaim(data, claimId) {
    await updateClaim(claimId, data);
    const updatedClaim = await getClaim(claimId);
    setClaims(prev => prev.map(c => c.$id === claimId ? updatedClaim : c));
  }

  async function handleDeleteClaim(claimId) {
    await deleteClaim(claimId);
    setClaims(prev => prev.filter(c => c.$id !== claimId));
  }

  // ==================== QUALIFIER HANDLERS ====================
  async function handleCreateQualifier(data) {
    const teamId = activeTeam?.$id || null;
    await createQualifier(data, teamId);
    const claimId = data.claim; // data.claim is passed from ClaimsList -> ClaimItem -> AddQualifierButton
    const updatedClaim = await getClaim(claimId);
    setClaims(prev => prev.map(c => c.$id === claimId ? updatedClaim : c));
  }

  async function handleUpdateQualifier(data, qualifierId, claimId) {
    await updateQualifier(qualifierId, data);
    const updatedClaim = await getClaim(claimId);
    setClaims(prev => prev.map(c => c.$id === claimId ? updatedClaim : c));
  }

  async function handleDeleteQualifier(qualifierId, claimId) {
    await deleteQualifier(qualifierId);
    const updatedClaim = await getClaim(claimId);
    setClaims(prev => prev.map(c => c.$id === claimId ? updatedClaim : c));
  }

  // ==================== REFERENCE HANDLERS ====================
  async function handleCreateReference(data) {
    const teamId = activeTeam?.$id || null;
    await createReference(data, teamId);
    const claimId = data.claim; // data.claim is passed from ClaimsList -> ClaimItem -> AddReferenceButton
    const updatedClaim = await getClaim(claimId);
    setClaims(prev => prev.map(c => c.$id === claimId ? updatedClaim : c));
  }

  async function handleUpdateReference(data, referenceId, claimId) {
    await updateReference(referenceId, data);
    await loadEntity();
  }

  async function handleDeleteReference(referenceId) {
    await deleteReference(referenceId);
    await loadEntity();
  }

  if (loading || authLoading) {
    return (
      <div className="explorer-layout">
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
            onPermissionsUpdated={loadEntity}
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

          {/* Incoming Relations - Using new component */}
          <RelationshipsView
            entityId={id}
            type="incoming"
            title="Lo que enlaza aquí"
            icon="icon-arrow-left"
          />

          {/* Used as Property - Using new component */}
          <RelationshipsView
            entityId={id}
            type="property"
            title="Usado como propiedad"
            icon="icon-tag"
          />

          {/* Used as Property in Qualifiers */}
          <RelationshipsView
            entityId={id}
            type="qualifier_property"
            title="Usado como propiedad (Calificador)"
            icon="icon-tag"
          />

          {/* Used as Value in Qualifiers */}
          <RelationshipsView
            entityId={id}
            type="qualifier_value"
            title="Usado como valor (Calificador)"
            icon="icon-link"
          />

          {/* Referenced In - Using new component */}
          <RelationshipsView
            entityId={id}
            type="references"
            title="Citado en"
            icon="icon-book"
          />
        </div>
      </main>
    </div>
  );
}

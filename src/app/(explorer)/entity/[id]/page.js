"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EntityHeader, ClaimsList, LoadingState, ErrorState, RelationshipsView } from "@/components";
import EntityStatistics from "@/components/EntityStatistics";
import EntityGraph from "@/components/EntityGraph";
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
  getClaimsByValueRelation,
  getClaimsByProperty,
  getReferencesByEntityRole,
  getQualifiersByEntityRole,
  getClaimsBySubject,
  getClaimPropertiesSummary,
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
  const [activeTab, setActiveTab] = useState("overview");

  const [claimsPage, setClaimsPage] = useState(1);
  const [claimsLimit] = useState(50);
  const [claimsTotal, setClaimsTotal] = useState(0);
  const [claimsFilters, setClaimsFilters] = useState({ property: null, value: "" });
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimPropertiesSummary, setClaimPropertiesSummary] = useState(null);

  const [graphData, setGraphData] = useState({
    incoming: [],
    asProperty: [],
    references: [],
    asQualifierValue: []
  });

  // Permisos de edición basados en el contexto de autenticación
  const editable = canEdit || canCreate || canDelete;

  useEffect(() => {
    loadEntity();
  }, [id]);

  // Fetch claims when filters change (reset page)
  useEffect(() => {
    if (entity) {
      setClaimsPage(1);
      loadClaims(true); // pass true to indicate a replace
    }
  }, [claimsFilters]);

  async function loadClaims(replace = false) {
    if (!entity) return;
    setClaimsLoading(true);
    try {
      const currentPage = replace ? 1 : claimsPage;
      const offset = (currentPage - 1) * claimsLimit;
      const result = await getClaimsBySubject(id, {
        limit: claimsLimit,
        offset,
        filters: claimsFilters
      });

      setClaims(prev => {
        if (replace) return result.claims || [];
        const map = new Map();
        prev.forEach(c => map.set(c.$id, c));
        (result.claims || []).forEach(c => map.set(c.$id, c));
        return Array.from(map.values());
      });
      setClaimsTotal(result.total || 0);
    } catch (err) {
      console.error("Error loading claims:", err);
    } finally {
      setClaimsLoading(false);
    }
  }

  async function handleLoadMore() {
    setClaimsPage(prev => prev + 1);
  }

  // Carga progresiva automática
  useEffect(() => {
    let timer;
    if (entity && claims.length > 0 && claims.length < claimsTotal && !claimsLoading) {
      timer = setTimeout(() => {
        setClaimsPage(prev => prev + 1);
      }, 500);
    }
    return () => clearTimeout(timer);
  }, [entity, claims.length, claimsTotal, claimsLoading]);

  // Carga automática por cambios de página (si no es replace)
  useEffect(() => {
    if (entity && claimsPage > 1) {
      loadClaims(false);
    }
  }, [claimsPage]);

  async function handleRequirePropertyLoad(propertyId) {
    try {
      const result = await getClaimsBySubject(id, {
        limit: 500, // Carga hasta 500 valores para esta propiedad específica
        filters: { ...claimsFilters, property: propertyId }
      });

      setClaims(prev => {
        const map = new Map();
        prev.forEach(c => map.set(c.$id, c));
        (result.claims || []).forEach(c => map.set(c.$id, c));
        return Array.from(map.values());
      });
    } catch (err) {
      console.error("Error cargando propiedad específica:", err);
    }
  }

  async function loadEntity() {
    setLoading(true);
    setError(null);
    setEntity(null);
    setClaims([]);
    try {
      // 1. Fetch main entity
      const entityData = await getEntity(id, true);
      setEntity(entityData);

      // 2. Fetch outgoing claims details with pagination
      // Initial load uses default page 1 and empty filters
      const claimsOffset = 0;
      const claimsResult = await getClaimsBySubject(id, {
        limit: claimsLimit,
        offset: claimsOffset,
        filters: claimsFilters
      });
      setClaims(claimsResult.claims || []);
      setClaimsTotal(claimsResult.total || 0);

      // 3. Fetch other relationships for Graph (Parallel)
      // We fetch a reasonable limit for visualization (e.g., 50 each)
      const limit = 50;
      const [incomingRes, propertyRes, refRes, qualValueRes, summaryRes] = await Promise.all([
        getClaimsByValueRelation(id, { limit }),
        getClaimsByProperty(id, { limit }),
        getReferencesByEntityRole(id, { limit }),
        getQualifiersByEntityRole(id, { limit, role: 'value' }),
        getClaimPropertiesSummary(id)
      ]);

      setClaimPropertiesSummary(summaryRes || {});

      setGraphData({
        incoming: incomingRes?.claims || [],
        asProperty: propertyRes?.claims || [],
        references: refRes?.references || [],
        asQualifierValue: qualValueRes?.qualifiers || []
      });

    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  // ==================== ENTITY HANDLERS ====================
  async function handleUpdateEntity(data) {
    await updateEntity(id, data);
    setEntity(prev => ({
      ...prev,
      ...data,
      $updatedAt: new Date().toISOString()
    }));
  }

  async function handleDeleteEntity() {
    await deleteEntity(id);
    router.push("/entities");
  }

  // ==================== CLAIM HANDLERS ====================
  async function handleCreateClaim(data) {
    const teamId = activeTeam?.$id || null;
    const newClaimRaw = await createClaim(data, teamId);

    // Fetch fully expanded claim to get resolved property/entity data
    const newClaim = await getClaim(newClaimRaw.$id);

    setClaims(prev => [newClaim, ...prev]);
    setClaimsTotal(prev => prev + 1);
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
    const updatedClaim = await getClaim(claimId);
    setClaims(prev => prev.map(c => c.$id === claimId ? updatedClaim : c));
  }

  async function handleDeleteReference(referenceId, claimId) {
    await deleteReference(referenceId);
    const updatedClaim = await getClaim(claimId);
    setClaims(prev => prev.map(c => c.$id === claimId ? updatedClaim : c));
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

          {/* Tabs Navigation */}
          <div className="entity-tabs">
            <button
              className={`entity-tab ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Declaraciones
            </button>
            <button
              className={`entity-tab ${activeTab === "relationships" ? "active" : ""}`}
              onClick={() => setActiveTab("relationships")}
            >
              Relaciones
            </button>
            <button
              className={`entity-tab ${activeTab === "statistics" ? "active" : ""}`}
              onClick={() => setActiveTab("statistics")}
            >
              Estadísticas
            </button>
            <button
              className={`entity-tab ${activeTab === "graph" ? "active" : ""}`}
              onClick={() => setActiveTab("graph")}
            >
              Grafo
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <>
              {/* Claims / Statements */}
              <section className="entity-statements">
                <h2 className="section-title">
                  <span className="icon-list"></span>
                  Declaraciones
                </h2>
                <ClaimsList
                  claims={claims}
                  loading={claimsLoading}
                  hasMore={claims.length < claimsTotal}
                  onLoadMore={handleLoadMore}
                  filters={claimsFilters}
                  onFilterChange={(newFilters) => {
                    setClaimsFilters(prev => ({ ...prev, ...newFilters }));
                  }}
                  claimPropertiesSummary={claimPropertiesSummary}
                  onRequirePropertyLoad={handleRequirePropertyLoad}
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

            </>
          )}

          {activeTab === "relationships" && (
            <div className="mt-6">
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
          )}

          {activeTab === "statistics" && (
            <div className="mt-6">
              <EntityStatistics entity={{ ...entity, claims }} />
            </div>
          )}

          {activeTab === "graph" && (
            <div className="mt-6">
              <EntityGraph entity={{ ...entity, claims }} otherRelations={graphData} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navigation, LoadingState } from "@/components";
import { useAuth } from "@/context/AuthContext";
import {
  listTransactions,
  listAuditEntries,
  approveAuditEntry,
  rejectAuditEntry,
  rollbackAuditEntry,
} from "@/lib/database";

export default function AdminPage() {
  const router = useRouter();
  const { 
    user, 
    isAuthenticated, 
    authEnabled, 
    isAdmin,
    isMainTeamMember,
    permissions, 
    userTeams,
    activeTeam,
    mainTeamId,
    loading: authLoading 
  } = useAuth();

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [transactionsError, setTransactionsError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchId, setSearchId] = useState("");
  const [auditEntries, setAuditEntries] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const [auditStatusFilter, setAuditStatusFilter] = useState("pending");
  const [auditTableFilter, setAuditTableFilter] = useState("all");

  // Debug log
  useEffect(() => {
    console.log("[AdminPage] Auth state:", {
      authLoading,
      authEnabled,
      isAuthenticated,
      isAdmin,
      isMainTeamMember,
      userTeams: userTeams?.length,
      activeTeam: activeTeam?.name,
      mainTeamId,
      permissions
    });
  }, [authLoading, authEnabled, isAuthenticated, isAdmin, isMainTeamMember, userTeams, activeTeam, mainTeamId, permissions]);

  useEffect(() => {
    if (!authLoading) {
      // Si la autenticación está habilitada y el usuario no es admin, redirigir
      if (authEnabled && !isAdmin) {
        console.log("[AdminPage] Redirigiendo porque no es admin. isAdmin:", isAdmin);
        router.push("/");
        return;
      }
      setLoading(false);
    }
  }, [authLoading, authEnabled, isAdmin]);

  useEffect(() => {
    if (!authLoading && authEnabled && isAdmin) {
      loadTransactions();
      loadAuditEntries();
    }
  }, [authLoading, authEnabled, isAdmin]);

  async function loadTransactions() {
    setLoadingTransactions(true);
    setTransactionsError(null);
    try {
      const filters = {
        status: statusFilter,
        from: dateFrom ? new Date(`${dateFrom}T00:00:00Z`).toISOString() : null,
        to: dateTo ? new Date(`${dateTo}T23:59:59Z`).toISOString() : null,
        limit: 100,
      };
      const result = await listTransactions(filters);
      const filtered = (result || []).filter((tx) =>
        !searchId ? true : (tx.$id || "").includes(searchId)
      );
      setTransactions(filtered);
    } catch (err) {
      setTransactionsError(err.message || "No se pudieron cargar las transacciones");
    } finally {
      setLoadingTransactions(false);
    }
  }

  async function loadAuditEntries() {
    setLoadingAudit(true);
    setAuditError(null);
    try {
      const result = await listAuditEntries({
        status: auditStatusFilter,
        tableId: auditTableFilter,
        limit: 100,
      });
      setAuditEntries(result || []);
    } catch (err) {
      setAuditError(err.message || "No se pudieron cargar auditorías");
    } finally {
      setLoadingAudit(false);
    }
  }

  async function handleApproveAudit(entry) {
    await approveAuditEntry(entry.$id, "Aprobado por administrador");
    await loadAuditEntries();
  }

  async function handleRejectAudit(entry) {
    await rejectAuditEntry(entry.$id, "Rechazado por administrador");
    await loadAuditEntries();
  }

  async function handleRollbackAudit(entry) {
    await rollbackAuditEntry(entry, "Rollback por administrador");
    await loadAuditEntries();
  }

  function handleApplyFilters(e) {
    e.preventDefault();
    loadTransactions();
  }

  if (authLoading) {
    return (
      <div className="explorer-layout">
        <Navigation />
        <main className="explorer-main">
          <div className="explorer-container">
            <LoadingState message="Cargando..." />
          </div>
        </main>
      </div>
    );
  }

  // Verificar permisos
  if (authEnabled && !isAdmin) {
    return null; // Se redirigirá en el useEffect
  }

  return (
    <div className="explorer-layout">
      <Navigation />

      <main className="explorer-main">
        <div className="explorer-container">
          <header className="page-header">
            <div className="page-header-content">
              <h1 className="page-title">Panel de Administración</h1>
              <p className="page-subtitle">
                Gestión de permisos e historial de cambios
              </p>
            </div>
          </header>

          {/* Sección de Permisos */}
          <section className="admin-section">
            <h2 className="section-title">
              <span className="icon-shield"></span>
              Permisos del Usuario
            </h2>

            <div className="permissions-card">
              {authEnabled && user ? (
                <>
                  <div className="user-info">
                    <div className="user-avatar">
                      {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="user-details">
                      <h3 className="user-name">{user.name || "Usuario"}</h3>
                      <p className="user-email">{user.email}</p>
                      <p className="user-id">ID: {user.$id}</p>
                    </div>
                  </div>

                  <div className="permissions-grid">
                    <div className="permission-item">
                      <span className={`permission-badge ${permissions.canView ? "active" : "inactive"}`}>
                        {permissions.canView ? "✓" : "✗"}
                      </span>
                      <span className="permission-label">Ver</span>
                    </div>
                    <div className="permission-item">
                      <span className={`permission-badge ${permissions.canCreate ? "active" : "inactive"}`}>
                        {permissions.canCreate ? "✓" : "✗"}
                      </span>
                      <span className="permission-label">Crear</span>
                    </div>
                    <div className="permission-item">
                      <span className={`permission-badge ${permissions.canEdit ? "active" : "inactive"}`}>
                        {permissions.canEdit ? "✓" : "✗"}
                      </span>
                      <span className="permission-label">Editar</span>
                    </div>
                    <div className="permission-item">
                      <span className={`permission-badge ${permissions.canDelete ? "active" : "inactive"}`}>
                        {permissions.canDelete ? "✓" : "✗"}
                      </span>
                      <span className="permission-label">Eliminar</span>
                    </div>
                    <div className="permission-item">
                      <span className={`permission-badge ${permissions.isAdmin ? "active" : "inactive"}`}>
                        {permissions.isAdmin ? "✓" : "✗"}
                      </span>
                      <span className="permission-label">Administrador</span>
                    </div>
                  </div>

                  {permissions.roles.length > 0 && (
                    <div className="roles-section">
                      <h4>Roles asignados:</h4>
                      <div className="roles-list">
                        {permissions.roles.map((role, index) => (
                          <span key={index} className="role-badge">{role}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {userTeams.length > 0 && (
                    <div className="teams-section">
                      <h4>Equipos:</h4>
                      <div className="teams-list">
                        {userTeams.map((team) => (
                          <div 
                            key={team.$id} 
                            className={`team-card ${team.$id === mainTeamId ? "main-team" : ""} ${activeTeam?.$id === team.$id ? "active" : ""}`}
                          >
                            <div className="team-card-header">
                              <span className="team-name">
                                {team.$id === mainTeamId && <span className="main-badge">★ Main</span>}
                                {team.name}
                              </span>
                              {activeTeam?.$id === team.$id && (
                                <span className="active-badge">Activo</span>
                              )}
                            </div>
                            <div className="team-card-details">
                              <span className="team-id">ID: {team.$id}</span>
                              <span className="team-members-count">{team.total} miembros</span>
                            </div>
                            {team.roles && team.roles.length > 0 && (
                              <div className="team-roles">
                                {team.roles.map((role, idx) => (
                                  <span key={idx} className={`role-tag ${role}`}>{role}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isMainTeamMember && (
                    <div className="main-team-notice">
                      <span className="notice-icon">★</span>
                      <span>Eres miembro del Main Team. Tienes permisos de administrador.</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-auth-message">
                  <p>
                    {authEnabled 
                      ? "No hay usuario autenticado"
                      : "La autenticación está deshabilitada. Todos los usuarios tienen permisos completos."
                    }
                  </p>
                  {!authEnabled && (
                    <div className="permissions-grid">
                      <div className="permission-item">
                        <span className="permission-badge active">✓</span>
                        <span className="permission-label">Todos los permisos activos</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Sección de Transacciones */}
          <section className="admin-section">
            <h2 className="section-title">
              <span className="icon-history"></span>
              Transacciones
            </h2>

            <form className="transaction-filters" onSubmit={handleApplyFilters}>
              <div className="form-group">
                <label>Estado</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">Todas</option>
                  <option value="committed">Commit</option>
                  <option value="rolledback">Rollback</option>
                  <option value="pending">Pendiente</option>
                </select>
              </div>
              <div className="form-group">
                <label>Desde</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Hasta</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="form-group">
                <label>ID contiene</label>
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="Buscar por ID"
                />
              </div>
              <button className="btn btn-secondary" type="submit" disabled={loadingTransactions}>
                Aplicar filtros
              </button>
            </form>

            {loadingTransactions && <LoadingState message="Cargando transacciones..." />}
            {transactionsError && (
              <div className="admin-alert error">{transactionsError}</div>
            )}

            {!loadingTransactions && !transactionsError && transactions.length === 0 && (
              <p className="muted">No hay transacciones registradas.</p>
            )}

            {!loadingTransactions && !transactionsError && transactions.length > 0 && (
              <div className="transactions-list">
                {transactions.map((tx) => (
                  <div key={tx.$id} className="transaction-item">
                    <div className="transaction-info">
                      <strong>{tx.$id}</strong>
                      <span className="muted">
                        {tx.$createdAt || ""}
                      </span>
                    </div>
                    <span className={`status-chip ${tx.status === "committed" ? "success" : tx.status === "rolledback" ? "warning" : ""}`}>
                      {tx.status || "pendiente"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="admin-section">
            <h2 className="section-title">
              <span className="icon-history"></span>
              Auditoría de cambios
            </h2>

            <form className="transaction-filters" onSubmit={(e) => { e.preventDefault(); loadAuditEntries(); }}>
              <div className="form-group">
                <label>Estado</label>
                <select value={auditStatusFilter} onChange={(e) => setAuditStatusFilter(e.target.value)}>
                  <option value="pending">Pendiente</option>
                  <option value="approved">Aprobado</option>
                  <option value="rejected">Rechazado</option>
                  <option value="all">Todas</option>
                </select>
              </div>
              <div className="form-group">
                <label>Tabla</label>
                <select value={auditTableFilter} onChange={(e) => setAuditTableFilter(e.target.value)}>
                  <option value="all">Todas</option>
                  <option value="entities">entities</option>
                  <option value="claims">claims</option>
                  <option value="qualifiers">qualifiers</option>
                  <option value="references">references</option>
                </select>
              </div>
              <button className="btn btn-secondary" type="submit" disabled={loadingAudit}>
                Aplicar filtros
              </button>
            </form>

            {loadingAudit && <LoadingState message="Cargando auditorías..." />}
            {auditError && <div className="admin-alert error">{auditError}</div>}
            {!loadingAudit && !auditError && auditEntries.length === 0 && (
              <p className="muted">No hay cambios auditados.</p>
            )}
            {!loadingAudit && !auditError && auditEntries.length > 0 && (
              <div className="audit-list">
                {auditEntries.map((entry) => (
                  <div key={entry.$id} className="audit-item">
                    <div className="audit-info">
                      <strong>{entry.action}</strong>
                      <span className="muted">{entry.tableId} · {entry.rowId || ""}</span>
                      <span className="muted">{entry.userEmail || entry.userId || ""}</span>
                      <span className="muted">{entry.$createdAt || ""}</span>
                    </div>
                    <div className="audit-actions">
                      {entry.status === "pending" && (
                        <>
                          <button className="btn btn-primary" onClick={() => handleApproveAudit(entry)}>
                            Aprobar
                          </button>
                          <button className="btn btn-secondary" onClick={() => handleRejectAudit(entry)}>
                            Rechazar
                          </button>
                        </>
                      )}
                      <button className="btn btn-outline" onClick={() => handleRollbackAudit(entry)}>
                        Rollback
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </main>

      <footer className="explorer-footer">
        <p>Graph DB Explorer — Panel de Administración</p>
      </footer>
    </div>
  );
}

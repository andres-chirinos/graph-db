"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components";
import { useAuth } from "@/context/AuthContext";
import {
  createTeam,
  getTeamMembers,
  getPendingInvitations,
  inviteToTeam,
  updateMemberRoles,
  removeMember,
  deleteTeam,
  acceptTeamInvite,
  DEFAULT_TEAM_ROLES,
} from "@/lib/auth";
import "./style.css";

export default function TeamsPage() {
  const router = useRouter();
  const {
    user,
    userTeams,
    activeTeam,
    isAuthenticated,
    authEnabled,
    loading: authLoading,
    refreshUser,
    switchTeam,
  } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Estados para crear team
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  // Estados para ver miembros
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Estados para invitaciones pendientes
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  // Estados para invitar
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");

  useEffect(() => {
    if (!authLoading && authEnabled && !isAuthenticated) {
      router.push("/");
    }
  }, [authLoading, authEnabled, isAuthenticated, router]);

  useEffect(() => {
    if (selectedTeam) {
      loadTeamMembers(selectedTeam.$id);
    }
  }, [selectedTeam]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadPendingInvites();
    }
  }, [authLoading, isAuthenticated]);

  async function loadTeamMembers(teamId) {
    setLoadingMembers(true);
    try {
      const members = await getTeamMembers(teamId);
      setTeamMembers(members);
    } catch (err) {
      console.error("Error loading members:", err);
      setTeamMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function loadPendingInvites() {
    setLoadingInvites(true);
    try {
      const invites = await getPendingInvitations();
      setPendingInvites(invites);
    } catch (err) {
      console.error("Error loading invites:", err);
      setPendingInvites([]);
    } finally {
      setLoadingInvites(false);
    }
  }

  async function handleCreateTeam(e) {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await createTeam(newTeamName.trim());
      setNewTeamName("");
      setShowCreateForm(false);
      setSuccess("Equipo creado exitosamente");
      await refreshUser();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || "Error al crear el equipo");
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim() || !selectedTeam) return;

    setLoading(true);
    setError(null);
    try {
      await inviteToTeam(selectedTeam.$id, inviteEmail.trim(), [inviteRole]);
      setInviteEmail("");
      setShowInviteForm(false);
      setSuccess("Invitación enviada exitosamente");
      await loadTeamMembers(selectedTeam.$id);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || "Error al enviar la invitación");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateRole(membershipId, newRoles) {
    if (!selectedTeam) return;

    setLoading(true);
    setError(null);
    try {
      await updateMemberRoles(selectedTeam.$id, membershipId, newRoles);
      setSuccess("Roles actualizados");
      await loadTeamMembers(selectedTeam.$id);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || "Error al actualizar los roles");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveMember(membershipId) {
    if (!selectedTeam) return;
    if (!confirm("¿Estás seguro de que deseas eliminar este miembro?")) return;

    setLoading(true);
    setError(null);
    try {
      await removeMember(selectedTeam.$id, membershipId);
      setSuccess("Miembro eliminado");
      await loadTeamMembers(selectedTeam.$id);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || "Error al eliminar el miembro");
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptInvite(invite) {
    if (!invite?.secret) {
      setError("Esta invitación requiere el enlace enviado por correo.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await acceptTeamInvite(invite.teamId, invite.$id, invite.userId, invite.secret);
      setSuccess("Invitación aceptada");
      await refreshUser();
      await loadPendingInvites();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || "Error al aceptar la invitación");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeclineInvite(invite) {
    if (!invite?.teamId || !invite?.$id) return;
    if (!confirm("¿Quieres rechazar esta invitación?")) return;

    setLoading(true);
    setError(null);
    try {
      await removeMember(invite.teamId, invite.$id);
      setSuccess("Invitación rechazada");
      await loadPendingInvites();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || "Error al rechazar la invitación");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTeam(teamId) {
    if (!confirm("¿Estás seguro de que deseas eliminar este equipo? Esta acción no se puede deshacer.")) return;

    setLoading(true);
    setError(null);
    try {
      await deleteTeam(teamId);
      setSuccess("Equipo eliminado");
      setSelectedTeam(null);
      await refreshUser();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || "Error al eliminar el equipo");
    } finally {
      setLoading(false);
    }
  }

  function isTeamOwner(team) {
    return team?.roles?.includes("owner");
  }

  function isTeamAdmin(team) {
    return team?.roles?.includes("owner") || team?.roles?.includes("admin");
  }

  if (authLoading) {
    return (
      <div className="explorer-layout">
        <main className="explorer-main">
          <div className="explorer-container">
            <LoadingState message="Cargando..." />
          </div>
        </main>
      </div>
    );
  }

  if (!authEnabled) {
    return (
      <div className="explorer-layout">
        <main className="explorer-main">
          <div className="explorer-container">
            <div className="empty-state">
              <p>La autenticación no está habilitada</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="explorer-layout">
      <main className="explorer-main">
        <div className="explorer-container">
          <div className="page-header">
            <h1>Gestión de Equipos</h1>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateForm(true)}
            >
              + Crear Equipo
            </button>
          </div>

          {error && (
            <div className="alert alert-error">
              {error}
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              {success}
            </div>
          )}

          {/* Formulario de crear equipo */}
          {showCreateForm && (
            <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Crear Nuevo Equipo</h2>
                  <button className="close-btn" onClick={() => setShowCreateForm(false)}>×</button>
                </div>
                <form onSubmit={handleCreateTeam}>
                  <div className="form-group">
                    <label>Nombre del equipo</label>
                    <input
                      type="text"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="Ej: Mi Equipo de Trabajo"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label>Roles disponibles</label>
                    <div className="roles-preview">
                      {DEFAULT_TEAM_ROLES.map((role) => (
                        <span key={role} className={`role-badge ${role}`}>
                          {role}
                        </span>
                      ))}
                    </div>
                    <small>Estos son los roles predeterminados para el equipo</small>
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowCreateForm(false)}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      {loading ? "Creando..." : "Crear Equipo"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Lista de equipos */}
          <div className="teams-layout">
            <div className="teams-list-panel">
              {/* Invitaciones pendientes */}
              <div className="invites-panel">
                <div className="section-header">
                  <h3>Invitaciones pendientes</h3>
                </div>
                {loadingInvites ? (
                  <LoadingState message="Cargando invitaciones..." />
                ) : pendingInvites.length === 0 ? (
                  <div className="empty-state compact">
                    <p>No tienes invitaciones pendientes</p>
                  </div>
                ) : (
                  <div className="invites-list">
                    {pendingInvites.map((invite) => (
                      <div key={invite.$id} className="invite-item">
                        <div className="invite-info">
                          <span className="invite-team">
                            {invite.teamName || invite.teamId}
                          </span>
                          <span className="invite-role">
                            Rol: {invite.roles?.[0] || "viewer"}
                          </span>
                        </div>
                        <div className="invite-actions">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAcceptInvite(invite)}
                            disabled={loading}
                          >
                            Aceptar
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDeclineInvite(invite)}
                            disabled={loading}
                          >
                            Rechazar
                          </button>
                        </div>
                      </div>
                    ))}
                    {pendingInvites.some((invite) => !invite.secret) && (
                      <div className="invite-hint">
                        Algunas invitaciones requieren el enlace del correo para aceptarse.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <h2>Mis Equipos ({userTeams.length})</h2>
              {userTeams.length === 0 ? (
                <div className="empty-state">
                  <p>No perteneces a ningún equipo</p>
                  <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
                    Crear tu primer equipo
                  </button>
                </div>
              ) : (
                <ul className="teams-list">
                  {userTeams.map((team) => (
                    <li
                      key={team.$id}
                      className={`team-item ${selectedTeam?.$id === team.$id ? "selected" : ""} ${activeTeam?.$id === team.$id ? "active" : ""}`}
                      onClick={() => setSelectedTeam(team)}
                    >
                      <div className="team-item-info">
                        <span className="team-name">{team.name}</span>
                        <div className="team-meta">
                          <span className="team-members-count">{team.total} miembros</span>
                          <span className={`role-badge small ${team.roles?.[0] || "viewer"}`}>
                            {team.roles?.[0] || "viewer"}
                          </span>
                        </div>
                      </div>
                      {activeTeam?.$id === team.$id && (
                        <span className="active-indicator">Activo</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Panel de detalles del equipo */}
            <div className="team-details-panel">
              {selectedTeam ? (
                <>
                  <div className="team-details-header">
                    <div>
                      <h2>{selectedTeam.name}</h2>
                      <p className="team-id">ID: {selectedTeam.$id}</p>
                    </div>
                    <div className="team-actions">
                      {activeTeam?.$id !== selectedTeam.$id && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => switchTeam(selectedTeam)}
                        >
                          Activar
                        </button>
                      )}
                      {isTeamOwner(selectedTeam) && (
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDeleteTeam(selectedTeam.$id)}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sección de miembros */}
                  <div className="team-members-section">
                    <div className="section-header">
                      <h3>Miembros</h3>
                      {isTeamAdmin(selectedTeam) && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setShowInviteForm(true)}
                        >
                          + Invitar
                        </button>
                      )}
                    </div>

                    {loadingMembers ? (
                      <LoadingState message="Cargando miembros..." />
                    ) : (
                      <div className="members-list">
                        {teamMembers.map((member) => (
                          <div key={member.$id} className="member-item">
                            <div className="member-info">
                              <div className="member-avatar">
                                {member.userName?.charAt(0).toUpperCase() || member.userEmail?.charAt(0).toUpperCase() || "?"}
                              </div>
                              <div className="member-details">
                                <span className="member-name">
                                  {member.userName || member.userEmail}
                                </span>
                                <span className="member-email">{member.userEmail}</span>
                                {!member.confirm && (
                                  <span className="pending-badge">Pendiente</span>
                                )}
                              </div>
                            </div>
                            <div className="member-roles">
                              <span className={`role-badge ${member.roles?.[0] || "viewer"}`}>
                                {member.roles?.[0] || "viewer"}
                              </span>
                            </div>
                            {isTeamAdmin(selectedTeam) && member.userId !== user?.$id && !member.roles?.includes("owner") && (
                              <div className="member-actions">
                                <select
                                  value={member.roles?.[0] || "viewer"}
                                  onChange={(e) => handleUpdateRole(member.$id, [e.target.value])}
                                  disabled={loading}
                                >
                                  {DEFAULT_TEAM_ROLES.filter(r => r !== "owner").map((role) => (
                                    <option key={role} value={role}>
                                      {role}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleRemoveMember(member.$id)}
                                  disabled={loading}
                                >
                                  Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Formulario de invitación */}
                  {showInviteForm && (
                    <div className="modal-overlay" onClick={() => setShowInviteForm(false)}>
                      <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                          <h2>Invitar a {selectedTeam.name}</h2>
                          <button className="close-btn" onClick={() => setShowInviteForm(false)}>×</button>
                        </div>
                        <form onSubmit={handleInvite}>
                          <div className="form-group">
                            <label>Email del usuario</label>
                            <input
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="usuario@ejemplo.com"
                              required
                              autoFocus
                            />
                          </div>
                          <div className="form-group">
                            <label>Rol</label>
                            <select
                              value={inviteRole}
                              onChange={(e) => setInviteRole(e.target.value)}
                            >
                              {DEFAULT_TEAM_ROLES.filter(r => r !== "owner").map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="modal-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowInviteForm(false)}>
                              Cancelar
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                              {loading ? "Enviando..." : "Enviar Invitación"}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <p>Selecciona un equipo para ver sus detalles</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}

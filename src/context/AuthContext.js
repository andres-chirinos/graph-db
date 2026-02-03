"use client";

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import {
  getCurrentUser,
  getUserTeams,
  getAllTeams,
  joinTeam,
  leaveTeam,
  login as authLogin,
  logout as authLogout,
  register as authRegister,
  isAuthEnabled,
} from "@/lib/auth";

const AuthContext = createContext(null);

// ID del Main Team (equipo de administradores)
const MAIN_TEAM_ID = process.env.NEXT_PUBLIC_MAIN_TEAM_ID || "main";

// Roles de equipo que tienen permisos de edición
const EDITOR_ROLES = ["owner", "admin", "editor", "member"];
// Roles de equipo que tienen permisos de administrador
const ADMIN_ROLES = ["owner", "admin"];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userTeams, setUserTeams] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authEnabled] = useState(isAuthEnabled());

  // Cargar team activo desde localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTeamId = localStorage.getItem("activeTeamId");
      if (savedTeamId && userTeams.length > 0) {
        const team = userTeams.find((t) => t.$id === savedTeamId);
        if (team) {
          setActiveTeam(team);
        }
      }
    }
  }, [userTeams]);

  useEffect(() => {
    if (authEnabled) {
      checkUser();
    } else {
      setLoading(false);
    }
  }, [authEnabled]);

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        const teams = await getUserTeams();
        setUserTeams(teams);

        // Obtener todos los teams disponibles
        const available = await getAllTeams();
        setAllTeams(available);

        // Si no hay team activo, usar el primero o el Main Team
        if (!activeTeam && teams.length > 0) {
          const mainTeam = teams.find((t) => t.$id === MAIN_TEAM_ID);
          setActiveTeam(mainTeam || teams[0]);
        }
      }
    } catch (error) {
      setUser(null);
      setUserTeams([]);
      setAllTeams([]);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const session = await authLogin(email, password);
    await checkUser();
    return session;
  }

  async function register(email, password, name) {
    const result = await authRegister(email, password, name);
    await checkUser();
    return result;
  }

  async function logout() {
    await authLogout();
    setUser(null);
    setUserTeams([]);
    setAllTeams([]);
    setActiveTeam(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("activeTeamId");
    }
  }

  // Cambiar el team activo
  const switchTeam = useCallback((team) => {
    setActiveTeam(team);
    if (typeof window !== "undefined") {
      localStorage.setItem("activeTeamId", team.$id);
    }
  }, []);

  // Unirse a un team
  const handleJoinTeam = useCallback(async (teamId) => {
    try {
      await joinTeam(teamId);
      await checkUser();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  // Salir de un team
  const handleLeaveTeam = useCallback(async (teamId, membershipId) => {
    try {
      await leaveTeam(teamId, membershipId);
      await checkUser();
      // Si salimos del team activo, cambiar a otro
      if (activeTeam?.$id === teamId) {
        const remainingTeams = userTeams.filter((t) => t.$id !== teamId);
        setActiveTeam(remainingTeams[0] || null);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [activeTeam, userTeams]);

  // Calcular permisos basados en el team activo
  const permissions = useMemo(() => {
    // Si la autenticación no está habilitada, permitir todo
    if (!authEnabled) {
      return {
        canView: true,
        canEdit: true,
        canDelete: true,
        canCreate: true,
        isAdmin: true,
        isMainTeamMember: true,
        roles: ["admin"],
      };
    }

    // Si no hay usuario autenticado, solo permisos de lectura
    if (!user) {
      return {
        canView: true,
        canEdit: false,
        canDelete: false,
        canCreate: false,
        isAdmin: false,
        isMainTeamMember: false,
        roles: [],
      };
    }

    // Verificar si es miembro del Main Team
    const isMainTeamMember = userTeams.some((t) => t.$id === MAIN_TEAM_ID);

    // Obtener roles del usuario en el team activo
    const userRoles = [];
    if (activeTeam) {
      if (activeTeam.roles) {
        userRoles.push(...activeTeam.roles);
      }
    }

    // Verificar si tiene rol de editor en el team activo
    const hasEditorRole = userRoles.some((role) => 
      EDITOR_ROLES.includes(role.toLowerCase())
    );

    // Verificar si tiene rol de admin en el team activo
    const hasAdminRole = userRoles.some((role) => 
      ADMIN_ROLES.includes(role.toLowerCase())
    );

    // Los miembros del Main Team siempre tienen permisos de admin
    const isAdminUser = isMainTeamMember || hasAdminRole;

    return {
      canView: true,
      canEdit: isMainTeamMember || hasEditorRole || hasAdminRole,
      canDelete: isMainTeamMember || hasEditorRole || hasAdminRole,
      canCreate: isMainTeamMember || hasEditorRole || hasAdminRole,
      isAdmin: isAdminUser,
      isMainTeamMember,
      roles: [...new Set(userRoles)],
    };
  }, [authEnabled, user, userTeams, activeTeam]);

  const value = {
    user,
    userTeams,
    allTeams,
    activeTeam,
    loading,
    authEnabled,
    isAuthenticated: !!user,
    permissions,
    mainTeamId: MAIN_TEAM_ID,
    // Helpers de permisos
    canEdit: permissions.canEdit,
    canDelete: permissions.canDelete,
    canCreate: permissions.canCreate,
    isAdmin: permissions.isAdmin,
    isMainTeamMember: permissions.isMainTeamMember,
    // Funciones
    login,
    register,
    logout,
    refreshUser: checkUser,
    switchTeam,
    joinTeam: handleJoinTeam,
    leaveTeam: handleLeaveTeam,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

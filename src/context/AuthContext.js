"use client";

import { createContext, useContext, useState, useEffect, useMemo } from "react";
import {
  getCurrentUser,
  getUserTeams,
  login as authLogin,
  logout as authLogout,
  register as authRegister,
  isAuthEnabled,
} from "@/lib/auth";

const AuthContext = createContext(null);

// Roles de equipo que tienen permisos de edición
const EDITOR_ROLES = ["owner", "admin", "editor"];
// Roles de equipo que tienen permisos de administrador
const ADMIN_ROLES = ["owner", "admin"];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userTeams, setUserTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authEnabled] = useState(isAuthEnabled());

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
      }
    } catch (error) {
      setUser(null);
      setUserTeams([]);
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
  }

  // Calcular permisos basados en teams y memberships
  const permissions = useMemo(() => {
    // Si la autenticación no está habilitada, permitir todo
    if (!authEnabled) {
      return {
        canView: true,
        canEdit: true,
        canDelete: true,
        canCreate: true,
        isAdmin: true,
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
        roles: [],
      };
    }

    // Obtener roles del usuario en los teams
    const userRoles = [];
    for (const team of userTeams) {
      // Los roles vienen en el membership del team
      if (team.roles) {
        userRoles.push(...team.roles);
      }
      // También verificar si hay $permissions en el team
      if (team.$permissions) {
        // Parsear permisos si están en formato de string
        team.$permissions.forEach((perm) => {
          if (perm.includes("write")) {
            userRoles.push("editor");
          }
        });
      }
    }

    // Verificar si tiene rol de editor
    const hasEditorRole = userRoles.some((role) => 
      EDITOR_ROLES.includes(role.toLowerCase())
    );

    // Verificar si tiene rol de admin
    const hasAdminRole = userRoles.some((role) => 
      ADMIN_ROLES.includes(role.toLowerCase())
    );

    return {
      canView: true,
      canEdit: hasEditorRole || hasAdminRole,
      canDelete: hasEditorRole || hasAdminRole,
      canCreate: hasEditorRole || hasAdminRole,
      isAdmin: hasAdminRole,
      roles: [...new Set(userRoles)],
    };
  }, [authEnabled, user, userTeams]);

  const value = {
    user,
    userTeams,
    loading,
    authEnabled,
    isAuthenticated: !!user,
    permissions,
    // Helpers de permisos
    canEdit: permissions.canEdit,
    canDelete: permissions.canDelete,
    canCreate: permissions.canCreate,
    isAdmin: permissions.isAdmin,
    login,
    register,
    logout,
    refreshUser: checkUser,
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

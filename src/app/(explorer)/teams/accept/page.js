"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingState } from "@/components";
import { acceptTeamInvite } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import "./style.css";

export default function AcceptTeamInvitePage() {
  return (
    <div className="explorer-layout">
      <main className="explorer-main">
        <div className="explorer-container">
          <Suspense fallback={<LoadingState message="Cargando invitación..." />}>
            <AcceptTeamInviteContent />
          </Suspense>
        </div>
      </main>

    </div>
  );
}

function AcceptTeamInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authEnabled, isAuthenticated, loading: authLoading, refreshUser } = useAuth();

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const membershipId = searchParams.get("membershipId");
  const userId = searchParams.get("userId");
  const secret = searchParams.get("secret");
  const teamId = searchParams.get("teamId");
  const teamName = searchParams.get("teamName");

  useEffect(() => {
    if (authLoading) return;

    if (!membershipId || !userId || !secret || !teamId) {
      setStatus("error");
      setError("Faltan parámetros de la invitación.");
      return;
    }

    if (authEnabled && !isAuthenticated) {
      setStatus("need-login");
      return;
    }

    if (status !== "idle") return;

    const acceptInvite = async () => {
      setStatus("loading");
      setError(null);
      try {
        await acceptTeamInvite(teamId, membershipId, userId, secret);
        await refreshUser();
        setStatus("success");
      } catch (err) {
        setStatus("error");
        setError(err?.message || "Error al aceptar la invitación");
      }
    };

    acceptInvite();
  }, [
    authLoading,
    authEnabled,
    isAuthenticated,
    membershipId,
    userId,
    secret,
    teamId,
    status,
    refreshUser,
  ]);

  return (
    <div className="invite-accept-card">
      <h1>Aceptar invitación</h1>
      {teamName && <p className="team-name">Equipo: {teamName}</p>}

      {status === "loading" && <LoadingState message="Aceptando invitación..." />}

      {status === "success" && (
        <div className="alert alert-success">
          Invitación aceptada. Ya puedes ingresar al equipo.
        </div>
      )}

      {status === "need-login" && (
        <div className="alert alert-error">
          Necesitas iniciar sesión para aceptar esta invitación.
        </div>
      )}

      {status === "error" && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="actions">
        {status === "success" && (
          <button className="btn btn-primary" onClick={() => router.push("/teams")}>Ir a equipos</button>
        )}
        {status === "need-login" && (
          <button className="btn btn-primary" onClick={() => router.push("/")}>Ir a inicio</button>
        )}
        {status === "error" && (
          <button className="btn btn-secondary" onClick={() => router.push("/teams")}>Volver</button>
        )}
      </div>
    </div>
  );
}

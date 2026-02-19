"use client";

/**
 * Estados de carga y error para el explorador
 */
import "./States.css";

export function LoadingState({ message = "Cargando..." }) {
  return (
    <div className="loading-state">
      <div className="loading-spinner"></div>
      <p>{message}</p>
    </div>
  );
}

export function ErrorState({
  error,
  title = "Error",
  onRetry
}) {
  return (
    <div className="error-state">
      <span className="icon-alert-triangle error-icon"></span>
      <h3>{title}</h3>
      <p>{error?.message || error || "Ha ocurrido un error inesperado"}</p>
      {onRetry && (
        <button onClick={onRetry} className="retry-button">
          <span className="icon-refresh-cw"></span>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title = "Sin resultados",
  message = "No se encontraron elementos",
  icon = "inbox"
}) {
  return (
    <div className="empty-state">
      <span className={`icon-${icon} empty-icon`}></span>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

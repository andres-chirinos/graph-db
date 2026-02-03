"use client";

import { useEffect, useRef } from "react";

/**
 * Modal reutilizable para formularios de edición
 */
export default function EditModal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  onSubmit,
  submitLabel = "Guardar",
  loading = false,
  size = "medium" // small, medium, large
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  function handleBackdropClick(e) {
    if (e.target === modalRef.current) {
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div 
      className="modal-backdrop" 
      ref={modalRef}
      onClick={handleBackdropClick}
    >
      <div className={`modal-content modal-${size}`}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button 
            className="modal-close" 
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="modal-body">
            {children}
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Guardando..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Modal de confirmación para eliminar
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmar eliminación",
  message,
  confirmLabel = "Eliminar",
  loading = false,
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  function handleBackdropClick(e) {
    if (e.target === modalRef.current) {
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div 
      className="modal-backdrop" 
      ref={modalRef}
      onClick={handleBackdropClick}
    >
      <div className="modal-content modal-small">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button 
            className="modal-close" 
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="confirm-message">{message}</p>
        </div>

        <div className="modal-footer">
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button 
            type="button" 
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Eliminando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

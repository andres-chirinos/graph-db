"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import UserMenu from "./UserMenu";
import AuthModal from "./AuthModal";
import EntitySelector from "./EntitySelector";
import EntityForm from "./EntityForm";
import { useAuth } from "@/context/AuthContext";
import { createEntity } from "@/lib/database";
import "./Navigation.css";

/**
 * Navegación principal del explorador
 */
export default function Navigation() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showEntityForm, setShowEntityForm] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const router = useRouter();
  const { isAdmin, isAuthenticated } = useAuth();

  async function handleCreateEntity(data) {
    const newEntity = await createEntity(data);
    router.push(`/entity/${newEntity.$id}`);
    setShowEntityForm(false);
    setShowMobileMenu(false);
  }

  function handleEntitySelect(entityId) {
    if (entityId) {
      router.push(`/entity/${entityId}`);
      setShowMobileMenu(false);
    }
  }

  function handleAdvancedSearch() {
    router.push(`/search?mode=advanced`);
    setShowMobileMenu(false);
  }

  function handleViewAll() {
    // This might need to capture the current search term from EntitySelector if possible,
    // but EntitySelector encapsulates it. 
    // For now, simpler to just go to search page or advanced.
    // If we want to support "View all for [term]", EntitySelector might need to expose the term or have a specific action event.
    // Given the props I added, I can put a button that links to /search.
    router.push(`/search`);
    setShowMobileMenu(false);
  }

  const dropdownFooter = (
    <div className="nav-search-actions">
      <button
        type="button"
        className="nav-search-action"
        onClick={handleAdvancedSearch}
      >
        Búsqueda avanzada
      </button>
      <button
        type="button"
        className="nav-search-action"
        onClick={handleViewAll}
      >
        Ver todos los resultados
      </button>
    </div>
  );

  return (
    <>
      <nav className="main-nav">
        <div className="nav-container">
          <div className="nav-header">
            <Link href="/" className="nav-logo">
              <span className="icon-database logo-icon"></span>
              <span className="logo-text">Base de Conocimiento</span>
            </Link>
            <button
              className="nav-toggle"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              aria-label="Toggle navigation"
            >
              <span className={`icon-${showMobileMenu ? 'menu' : 'menu'}`}></span>
            </button>
          </div>

          <div className={`nav-menu ${showMobileMenu ? 'active' : ''}`}>
            <div className="nav-links">
              <Link href="/" className="nav-link" onClick={() => setShowMobileMenu(false)}>
                <span className="icon-home"></span>
                <span>Inicio</span>
              </Link>
              <Link href="/entities" className="nav-link" onClick={() => setShowMobileMenu(false)}>
                <span className="icon-list"></span>
                <span>Entidades</span>
              </Link>
              {isAuthenticated && (
                <button
                  className="nav-link"
                  onClick={() => { setShowEntityForm(true); setShowMobileMenu(false); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit' }}
                >
                  <span className="icon-plus"></span>
                  <span>Crear Entidad</span>
                </button>
              )}
            </div>

            <div className="nav-search">
              <span className="icon-search nav-search-icon"></span>
              <EntitySelector
                placeholder="Buscar entidades..."
                onChange={handleEntitySelect}
                className="navbar-search"
                dropdownFooter={dropdownFooter}
                // We pass null value to keep it in "search mode" always
                value={null}
              />
            </div>

            <div className="nav-user">
              <UserMenu onLoginClick={() => {
                setShowAuthModal(true);
                setShowMobileMenu(false);
              }} />
            </div>
          </div>
        </div>
      </nav>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
      <EntityForm
        isOpen={showEntityForm}
        onClose={() => setShowEntityForm(false)}
        onSave={handleCreateEntity}
      />
    </>
  );
}

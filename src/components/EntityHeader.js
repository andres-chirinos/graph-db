"use client";

import Link from "next/link";
import ClaimsList from "./ClaimsList";

/**
 * Encabezado de entidad estilo Wikidata
 */
export default function EntityHeader({ entity }) {
  if (!entity) return null;

  const { $id, label, description, aliases, $createdAt, $updatedAt } = entity;

  return (
    <header className="entity-header">
      <div className="entity-header-main">
        <div className="entity-id-badge">
          <span className="id-prefix">ID:</span>
          <span className="id-value">{$id}</span>
        </div>

        <h1 className="entity-title">
          {label || <span className="no-label">(Sin etiqueta)</span>}
        </h1>

        {description && (
          <p className="entity-description-full">{description}</p>
        )}

        {aliases && aliases.length > 0 && (
          <div className="entity-aliases-full">
            <span className="aliases-label">También conocido como:</span>
            <ul className="aliases-list">
              {aliases.map((alias, index) => (
                <li key={index}>{alias}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="entity-header-meta">
        <div className="meta-item">
          <span className="meta-label">Creado:</span>
          <span className="meta-value">
            {new Date($createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Modificado:</span>
          <span className="meta-value">
            {new Date($updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </header>
  );
}

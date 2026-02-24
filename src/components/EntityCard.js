"use client";

import Link from "next/link";
import { HighlightText } from "@/components";
import "./EntityCard.css";

/**
 * Tarjeta de entidad para listados
 */
export default function EntityCard({ entity, highlightQuery = "" }) {
  if (!entity) return null;

  const { $id, label, description, aliases } = entity;

  return (
    <Link href={`/entity/${$id}`} className="entity-card">
      <div className="entity-card-content">
        <div className="entity-card-header">
          <span className="entity-id">{$id}</span>
          <h3 className="entity-label">
            {label ? <HighlightText text={label} query={highlightQuery} /> : "(Sin etiqueta)"}
          </h3>
        </div>

        {description && (
          <p className="entity-description">
            <HighlightText text={description} query={highlightQuery} />
          </p>
        )}

        {aliases && aliases.length > 0 && (
          <div className="entity-aliases">
            <span className="aliases-label">También conocido como:</span>
            <span className="aliases-list">
              <HighlightText text={aliases.slice(0, 5).join(", ")} query={highlightQuery} />
              {aliases.length > 5 && ` y ${aliases.length - 5} más`}
            </span>
          </div>
        )}
      </div>

      <span className="entity-card-arrow icon-cheveron-right"></span>
    </Link>
  );
}

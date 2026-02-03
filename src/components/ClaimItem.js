"use client";

import Link from "next/link";
import ValueRenderer from "./ValueRenderer";

/**
 * Muestra un claim individual con su propiedad, valor, qualifiers y referencias
 */
export default function ClaimItem({ claim, showQualifiers = true, showReferences = true }) {
  if (!claim) return null;

  const { $id, property, value_raw, value_relation, qualifiersList, referencesList } = claim;

  // Parsear value_raw si es string
  let parsedValue = null;
  if (value_raw) {
    try {
      parsedValue = typeof value_raw === "string" ? JSON.parse(value_raw) : value_raw;
    } catch (e) {
      parsedValue = { datatype: "string", data: value_raw };
    }
  }

  return (
    <div className="claim-item">
      <div className="claim-main">
        {/* Propiedad */}
        <div className="claim-property">
          {property ? (
            <Link href={`/entity/${property.$id}`} className="property-link">
              {property.label || property.$id}
            </Link>
          ) : (
            <span className="property-unknown">(Propiedad desconocida)</span>
          )}
        </div>

        {/* Valor */}
        <div className="claim-value">
          {value_relation ? (
            <Link href={`/entity/${value_relation.$id}`} className="value-entity-link">
              {value_relation.label || value_relation.$id}
            </Link>
          ) : parsedValue ? (
            <ValueRenderer value={parsedValue} />
          ) : (
            <span className="value-empty">(Sin valor)</span>
          )}
        </div>
      </div>

      {/* Qualifiers */}
      {showQualifiers && qualifiersList && qualifiersList.length > 0 && (
        <div className="claim-qualifiers">
          {qualifiersList.map((qualifier) => (
            <QualifierItem key={qualifier.$id} qualifier={qualifier} />
          ))}
        </div>
      )}

      {/* Referencias */}
      {showReferences && referencesList && referencesList.length > 0 && (
        <div className="claim-references">
          <details className="references-toggle">
            <summary>
              <span className="icon-info"></span>
              {referencesList.length} referencia{referencesList.length !== 1 ? "s" : ""}
            </summary>
            <div className="references-list">
              {referencesList.map((ref) => (
                <ReferenceItem key={ref.$id} reference={ref} />
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

/**
 * Muestra un qualifier
 */
function QualifierItem({ qualifier }) {
  const { property, value_raw, value_relation } = qualifier;

  let parsedValue = null;
  if (value_raw) {
    try {
      parsedValue = typeof value_raw === "string" ? JSON.parse(value_raw) : value_raw;
    } catch (e) {
      parsedValue = { datatype: "string", data: value_raw };
    }
  }

  return (
    <div className="qualifier-item">
      <span className="qualifier-property">
        {property ? (
          <Link href={`/entity/${property.$id}`}>
            {property.label || property.$id}
          </Link>
        ) : (
          "(Propiedad)"
        )}
      </span>
      <span className="qualifier-value">
        {value_relation ? (
          <Link href={`/entity/${value_relation.$id}`}>
            {value_relation.label || value_relation.$id}
          </Link>
        ) : parsedValue ? (
          <ValueRenderer value={parsedValue} compact />
        ) : (
          "(Sin valor)"
        )}
      </span>
    </div>
  );
}

/**
 * Muestra una referencia
 */
function ReferenceItem({ reference }) {
  const { details, reference: refEntity } = reference;

  return (
    <div className="reference-item">
      {refEntity && (
        <Link href={`/entity/${refEntity.$id}`} className="reference-entity">
          {refEntity.label || refEntity.$id}
        </Link>
      )}
      {details && <span className="reference-details">{details}</span>}
    </div>
  );
}

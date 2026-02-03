"use client";

import ClaimItem from "./ClaimItem";

/**
 * Lista de claims agrupados por propiedad (estilo Wikidata)
 */
export default function ClaimsList({ claims = [] }) {
  if (!claims || claims.length === 0) {
    return (
      <div className="claims-empty">
        <span className="icon-info"></span>
        <p>Esta entidad no tiene declaraciones.</p>
      </div>
    );
  }

  // Agrupar claims por propiedad
  const groupedClaims = claims.reduce((acc, claim) => {
    const propertyId = claim.property?.$id || "unknown";
    if (!acc[propertyId]) {
      acc[propertyId] = {
        property: claim.property,
        claims: [],
      };
    }
    acc[propertyId].claims.push(claim);
    return acc;
  }, {});

  return (
    <div className="claims-list">
      {Object.entries(groupedClaims).map(([propertyId, group]) => (
        <div key={propertyId} className="claims-group">
          <div className="claims-group-header">
            <span className="property-label">
              {group.property?.label || propertyId}
            </span>
          </div>
          <div className="claims-group-items">
            {group.claims.map((claim) => (
              <ClaimItem key={claim.$id} claim={claim} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

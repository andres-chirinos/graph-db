"use client";

import Link from "next/link";
import ValueRenderer from "./ValueRenderer";
import QualifierItem from "./QualifierItem";
import ReferenceItem from "./ReferenceItem";
import "./RelationshipItem.css";

function normalizeValue(valueRaw, datatype = "string") {
    if (valueRaw === null || valueRaw === undefined) return null;

    let data = valueRaw;
    if (typeof valueRaw === "string") {
        try {
            const parsed = JSON.parse(valueRaw);
            if (parsed && typeof parsed === "object" && parsed.datatype !== undefined && parsed.data !== undefined) {
                return { datatype: parsed.datatype || datatype, data: parsed.data };
            }
            if (["json", "object", "array"].includes(datatype)) {
                data = parsed;
            }
        } catch {
            data = valueRaw;
        }
    }

    return { datatype, data };
}

/**
 * Display a relationship item in a read-only format.
 * Used for "Incoming Relations", "Used as Property", and "Referenced In".
 */
export default function RelationshipItem({
    claim,
    type = "incoming", // incoming, property, reference
    currentEntityId,
}) {
    if (!claim) return null;

    const { subject, property, value_relation, value_raw, datatype, qualifiersList, referencesList } = claim;
    const parsedValue = normalizeValue(value_raw, datatype || property?.datatype || "string");

    return (
        <div className="relationship-item">
            <div className="relationship-main">
                {/* Subject */}
                <div className="relationship-part subject">
                    {type === "incoming" || type === "property" ? (
                        subject ? (
                            <Link href={`/entity/${subject.$id}`} className="entity-link">
                                {subject.label || subject.$id}
                            </Link>
                        ) : <span className="entity-unknown">(Desconocido)</span>
                    ) : (
                        // For references, the subject is the claim's subject
                        subject ? (
                            <Link href={`/entity/${subject.$id}`} className="entity-link">
                                {subject.label || subject.$id}
                            </Link>
                        ) : <span className="entity-unknown">(Desconocido)</span>
                    )}
                </div>

                {/* Arrow / Connector */}
                <div className="relationship-connector">
                    <span className="arrow">→</span>
                    <div className="property-badge">
                        {property ? (
                            <Link href={`/entity/${property.$id}`} className="property-link">
                                {property.label || property.$id}
                            </Link>
                        ) : <span className="property-unknown">?</span>}
                    </div>
                    <span className="arrow">→</span>
                </div>

                {/* Value */}
                <div className="relationship-part value">
                    {value_relation ? (
                        <Link href={`/entity/${value_relation.$id}`} className={value_relation.$id === currentEntityId ? "entity-link current" : "entity-link"}>
                            {value_relation.label || value_relation.$id}
                        </Link>
                    ) : parsedValue ? (
                        <ValueRenderer value={parsedValue} compact />
                    ) : (
                        <span className="value-empty">(Sin valor)</span>
                    )}
                </div>
            </div>

            {/* Qualifiers */}
            {qualifiersList && qualifiersList.length > 0 && (
                <div className="relationship-details">
                    <div className="relationship-detail-section">
                        <span className="detail-label">Calificadores:</span>
                        <div className="detail-list">
                            {qualifiersList.map(qualifier => (
                                <QualifierItem
                                    key={qualifier.$id}
                                    qualifier={qualifier}
                                    editable={false}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* References */}
            {referencesList && referencesList.length > 0 && (
                <div className="relationship-details">
                    <div className="relationship-detail-section">
                        <span className="detail-label">Referencias:</span>
                        <div className="detail-list">
                            {referencesList.map(ref => (
                                <ReferenceItem
                                    key={ref.$id}
                                    reference={ref}
                                    editable={false}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

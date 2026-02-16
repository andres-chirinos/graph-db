import { tablesDB, Query, Permission, Role } from "./appwrite";

export const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
export const TABLES = {
  ENTITIES: "entities",
  CLAIMS: "claims",
  QUALIFIERS: "qualifiers",
  REFERENCES: "references",
};

export const SYSTEM_FIELDS = new Set([
  "$id",
  "$createdAt",
  "$updatedAt",
  "$permissions",
  "$databaseId",
  "$tableId",
  "$collectionId",
]);

/**
 * Genera los permisos para un registro basándose en el team
 * @param {string} teamId - ID del team que crea el registro
 * @param {Object} options - Opciones adicionales
 * @returns {string[]} Array de permisos de Appwrite
 */
export function generatePermissions(teamId, options = {}) {
  const permissions = [];

  // Permisos de lectura: cualquiera puede leer (datos públicos)
  // permissions.push(Permission.read(Role.any()));

  if (teamId) {
    // Solo el team creador puede actualizar y eliminar
    permissions.push(Permission.update(Role.team(teamId)));
    permissions.push(Permission.delete(Role.team(teamId)));
  } else {
    // Si no hay team, solo usuarios autenticados pueden editar
    // permissions.push(Permission.update(Role.users()));
    // permissions.push(Permission.delete(Role.users()));
  }

  return permissions;
}

export function stripSystemFields(row) {
  const data = { ...row };
  for (const key of Object.keys(data)) {
    if (SYSTEM_FIELDS.has(key)) {
      delete data[key];
    }
  }
  return data;
}

/**
 * Normalizes a text string for case-insensitive and whitespace-agnostic comparison.
 * @param {string|any} value - The input value to normalize.
 * @returns {string} The normalized string.
 */
export const normalizeText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

/**
 * Stringifies a claim's raw value for comparison, handling various data types.
 * @param {any} rawValue - The raw value of the claim.
 * @returns {string} The string representation of the claim value.
 */
export const stringifyClaimValue = (rawValue) => {
  if (rawValue === null || rawValue === undefined) return "";
  if (typeof rawValue === "string") {
    try {
      const parsed = JSON.parse(rawValue);
      if (typeof parsed === "string" || typeof parsed === "number" || typeof parsed === "boolean") {
        return String(parsed);
      }
      if (parsed && typeof parsed === "object" && parsed.url) {
        return String(parsed.url);
      }
    } catch {
      return rawValue;
    }
    return rawValue;
  }
  if (typeof rawValue === "object" && rawValue.url) return String(rawValue.url);
  try {
    return JSON.stringify(rawValue);
  } catch {
    return String(rawValue);
  }
};

/**
 * @typedef {Object} PropertyCondition
 * @property {string} propertyId - The ID of the property.
 * @property {string} value - The value to match (raw text).
 * @property {"equal"|"contains"} [matchMode="contains"] - The matching mode for the value.
 */

/**
 * @typedef {Object} QualifierCondition
 * @property {string} propertyId - The ID of the qualifier property.
 * @property {string} value - The value to match (raw text).
 * @property {"equal"|"contains"} [matchMode="contains"] - The matching mode for the value.
 */

/**
 * @typedef {Object} ReferenceCondition
 * @property {string} referenceId - The ID of the entity that is referenced.
 */

/**
 * @typedef {Object} ClaimSchema
 * @property {string} propertyId - The ID of the main claim property.
 * @property {string} [value] - Optional: The value of the main claim.
 * @property {"equal"|"contains"} [valueMatchMode="contains"] - Optional: The matching mode for the claim value.
 * @property {QualifierCondition[]} [qualifiers] - Optional: Conditions for qualifiers associated with this claim.
 * @property {ReferenceCondition[]} [references] - Optional: Conditions for references associated with this claim.
 */

/**
 * @typedef {Object} EntitySchema
 * @property {string} [text] - Optional: Text to search in entity label/alias/description.
 * @property {PropertyCondition[]} [properties] - Optional: Properties that the entity must have (direct claims).
 * @property {ClaimSchema[]} [claims] - Optional: More complex claim conditions including qualifiers and references.
 * @property {("AND"|"OR")} [logic="AND"] - The logical operator to combine conditions. Defaults to AND.
 */

import { databases } from "./appwrite";
import { Query } from "appwrite";

// Configuración de la base de datos
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const COLLECTIONS = {
  ENTITIES: "entities",
  CLAIMS: "claims",
  QUALIFIERS: "qualifiers",
  REFERENCES: "references",
};

// ============================================
// ENTITIES
// ============================================

/**
 * Obtiene una entidad por su ID con todas sus relaciones
 */
export async function getEntity(entityId, includeRelations = true) {
  const result = await databases.getDocument({
    databaseId: DATABASE_ID,
    collectionId: COLLECTIONS.ENTITIES,
    documentId: entityId,
  });

  if (includeRelations) {
    // Obtener claims donde esta entidad es el sujeto
    const claims = await getClaimsBySubject(entityId);
    result.claims = claims;
  }

  return result;
}

/**
 * Busca entidades por texto (label, description, aliases)
 */
export async function searchEntities(searchTerm, limit = 20, offset = 0) {
  const queries = [
    Query.limit(limit),
    Query.offset(offset),
    Query.orderDesc("$createdAt"),
  ];

  if (searchTerm) {
    queries.push(Query.or([
      Query.contains("label", searchTerm),
      Query.contains("description", searchTerm),
      Query.contains("aliases", searchTerm),
    ]));
  }

  const result = await databases.listDocuments({
    databaseId: DATABASE_ID,
    collectionId: COLLECTIONS.ENTITIES,
    queries,
  });

  return result;
}

/**
 * Lista todas las entidades con paginación
 */
export async function listEntities(limit = 25, offset = 0) {
  const result = await databases.listDocuments({
    databaseId: DATABASE_ID,
    collectionId: COLLECTIONS.ENTITIES,
    queries: [
      Query.limit(limit),
      Query.offset(offset),
      Query.orderDesc("$createdAt"),
    ],
  });

  return result;
}

/**
 * Crea una nueva entidad
 */
export async function createEntity(data) {
  const result = await databases.createDocument({
    databaseId: DATABASE_ID,
    collectionId: COLLECTIONS.ENTITIES,
    documentId: "unique()",
    data: {
      label: data.label || null,
      description: data.description || null,
      aliases: data.aliases || [],
    },
  });

  return result;
}

/**
 * Actualiza una entidad existente
 */
export async function updateEntity(entityId, data) {
  const result = await databases.updateDocument({
    databaseId: DATABASE_ID,
    collectionId: COLLECTIONS.ENTITIES,
    documentId: entityId,
    data,
  });

  return result;
}

// ============================================
// CLAIMS
// ============================================

/**
 * Obtiene todos los claims de un sujeto (entidad)
 */
export async function getClaimsBySubject(subjectId) {
  const result = await databases.listDocuments({
    databaseId: DATABASE_ID,
    collectionId: COLLECTIONS.CLAIMS,
    queries: [
      Query.equal("subject", subjectId),
      Query.limit(100),
    ],
  });

  return result.documents;
}

/**
 * Obtiene un claim específico con sus qualifiers y references
 */
export async function getClaim(claimId) {
  const claim = await databases.getDocument({
    databaseId: DATABASE_ID,
    collectionId: COLLECTIONS.CLAIMS,
    documentId: claimId,
  });

  // Obtener qualifiers
  const qualifiers = await getQualifiersByClaim(claimId);
  claim.qualifiersList = qualifiers;

  // Obtener references
  const references = await getReferencesByClaim(claimId);
  claim.referencesList = references;

  return claim;
}

/**
 * Crea un nuevo claim
 */
export async function createClaim(data) {
  const result = await databases.createDocument({
    databaseId: DATABASE_ID,
    collectionId: COLLECTIONS.CLAIMS,
    documentId: "unique()",
    data: {
      subject: data.subject || null,
      property: data.property || null,
      value_raw: data.value_raw ? JSON.stringify(data.value_raw) : null,
      value_relation: data.value_relation || null,
    },
  });

  return result;
}

// ============================================
// QUALIFIERS
// ============================================

/**
 * Obtiene los qualifiers de un claim
 */
export async function getQualifiersByClaim(claimId) {
  const result = await databases.listDocuments({
    databaseId: DATABASE_ID,
    collectionId: COLLECTIONS.QUALIFIERS,
    queries: [
      Query.equal("claim", claimId),
      Query.limit(50),
    ],
  });

  return result.documents;
}

/**
 * Crea un nuevo qualifier
 */
export async function createQualifier(data) {
  const result = await databases.createDocument({
    databaseId: DATABASE_ID,
    collectionId: COLLECTIONS.QUALIFIERS,
    documentId: "unique()",
    data: {
      claim: data.claim || null,
      property: data.property || null,
      value_raw: data.value_raw ? JSON.stringify(data.value_raw) : null,
      value_relation: data.value_relation || null,
    },
  });

  return result;
}

// ============================================
// REFERENCES
// ============================================

/**
 * Obtiene las referencias de un claim
 */
export async function getReferencesByClaim(claimId) {
  const result = await databases.listDocuments({
    databaseId: DATABASE_ID,
    collectionId: COLLECTIONS.REFERENCES,
    queries: [
      Query.equal("claim", claimId),
      Query.limit(50),
    ],
  });

  return result.documents;
}

/**
 * Crea una nueva referencia
 */
export async function createReference(data) {
  const result = await databases.createDocument({
    databaseId: DATABASE_ID,
    collectionId: COLLECTIONS.REFERENCES,
    documentId: "unique()",
    data: {
      claim: data.claim || null,
      details: data.details || null,
      reference: data.reference || null,
    },
  });

  return result;
}

// ============================================
// UTILITIES
// ============================================

/**
 * Parsea un value_raw desde JSON string
 */
export function parseValueRaw(valueRaw) {
  if (!valueRaw) return null;
  
  try {
    if (typeof valueRaw === "string") {
      return JSON.parse(valueRaw);
    }
    return valueRaw;
  } catch (e) {
    // Si no es JSON válido, retornar como string simple
    return { datatype: "string", data: valueRaw };
  }
}

/**
 * Serializa un value para guardarlo como value_raw
 */
export function serializeValue(value) {
  if (typeof value === "string") {
    return JSON.stringify({ datatype: "string", data: value });
  }
  return JSON.stringify(value);
}

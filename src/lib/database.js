import { tablesDB, Query } from "./appwrite";

// Configuración de la base de datos
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const TABLES = {
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
  const result = await tablesDB.getRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.ENTITIES,
    rowId: entityId,
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

  const result = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.ENTITIES,
    queries,
  });

  return result;
}

/**
 * Lista todas las entidades con paginación
 */
export async function listEntities(limit = 25, offset = 0) {
  const result = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.ENTITIES,
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
  const result = await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.ENTITIES,
    rowId: "unique()",
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
  const result = await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.ENTITIES,
    rowId: entityId,
    data,
  });

  return result;
}

// ============================================
// CLAIMS
// ============================================

/**
 * Obtiene todos los claims de un sujeto (entidad)
 * Incluye los datos expandidos de property y value_relation
 */
export async function getClaimsBySubject(subjectId) {
  const result = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.CLAIMS,
    queries: [
      Query.equal("subject", subjectId),
      Query.select(["*", "subject.*", "property.*", "value_relation.*"]),
      Query.limit(100),
    ],
  });

  return result.rows;
}

/**
 * Obtiene todos los claims donde esta entidad es el value_relation (relaciones inversas)
 * Es decir, otras entidades que apuntan a esta entidad
 */
export async function getClaimsByValueRelation(entityId) {
  const result = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.CLAIMS,
    queries: [
      Query.equal("value_relation", entityId),
      Query.select(["*", "subject.*", "property.*", "value_relation.*"]),
      Query.limit(100),
    ],
  });

  return result.rows;
}

/**
 * Obtiene todos los claims donde esta entidad es usada como propiedad
 */
export async function getClaimsByProperty(propertyId) {
  const result = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.CLAIMS,
    queries: [
      Query.equal("property", propertyId),
      Query.select(["*", "subject.*", "property.*", "value_relation.*"]),
      Query.limit(100),
    ],
  });

  return result.rows;
}

/**
 * Obtiene un claim específico con sus qualifiers y references
 * Incluye los datos expandidos de las relaciones
 */
export async function getClaim(claimId) {
  const claim = await tablesDB.getRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.CLAIMS,
    rowId: claimId,
    queries: [
      Query.select(["*", "subject.*", "property.*", "value_relation.*"]),
    ],
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
  const result = await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.CLAIMS,
    rowId: "unique()",
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
 * Incluye los datos expandidos de property y value_relation
 */
export async function getQualifiersByClaim(claimId) {
  const result = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.QUALIFIERS,
    queries: [
      Query.equal("claim", claimId),
      Query.select(["*", "property.*", "value_relation.*"]),
      Query.limit(50),
    ],
  });

  return result.rows;
}

/**
 * Crea un nuevo qualifier
 */
export async function createQualifier(data) {
  const result = await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.QUALIFIERS,
    rowId: "unique()",
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
 * Incluye los datos expandidos de reference (entidad relacionada)
 */
export async function getReferencesByClaim(claimId) {
  const result = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.REFERENCES,
    queries: [
      Query.equal("claim", claimId),
      Query.select(["*", "reference.*"]),
      Query.limit(50),
    ],
  });

  return result.rows;
}

/**
 * Crea una nueva referencia
 */
export async function createReference(data) {
  const result = await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.REFERENCES,
    rowId: "unique()",
    data: {
      claim: data.claim || null,
      details: data.details || null,
      reference: data.reference || null,
    },
  });

  return result;
}

/**
 * Actualiza una referencia existente
 */
export async function updateReference(referenceId, data) {
  const updateData = {};
  if (data.details !== undefined) updateData.details = data.details;
  if (data.reference !== undefined) updateData.reference = data.reference;

  const result = await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.REFERENCES,
    rowId: referenceId,
    data: updateData,
  });

  return result;
}

/**
 * Elimina una referencia
 */
export async function deleteReference(referenceId) {
  await tablesDB.deleteRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.REFERENCES,
    rowId: referenceId,
  });
}

/**
 * Actualiza un qualifier existente
 */
export async function updateQualifier(qualifierId, data) {
  const updateData = {};
  if (data.property !== undefined) updateData.property = data.property;
  if (data.value_raw !== undefined) {
    updateData.value_raw = data.value_raw ? JSON.stringify(data.value_raw) : null;
  }
  if (data.value_relation !== undefined) updateData.value_relation = data.value_relation;

  const result = await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.QUALIFIERS,
    rowId: qualifierId,
    data: updateData,
  });

  return result;
}

/**
 * Elimina un qualifier
 */
export async function deleteQualifier(qualifierId) {
  await tablesDB.deleteRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.QUALIFIERS,
    rowId: qualifierId,
  });
}

/**
 * Actualiza un claim existente
 */
export async function updateClaim(claimId, data) {
  const updateData = {};
  if (data.property !== undefined) updateData.property = data.property;
  if (data.value_raw !== undefined) {
    updateData.value_raw = data.value_raw ? JSON.stringify(data.value_raw) : null;
  }
  if (data.value_relation !== undefined) updateData.value_relation = data.value_relation;

  const result = await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.CLAIMS,
    rowId: claimId,
    data: updateData,
  });

  return result;
}

/**
 * Elimina un claim y todos sus qualifiers y references asociados
 */
export async function deleteClaim(claimId) {
  // Primero eliminar qualifiers
  const qualifiers = await getQualifiersByClaim(claimId);
  for (const qualifier of qualifiers) {
    await deleteQualifier(qualifier.$id);
  }

  // Eliminar references
  const references = await getReferencesByClaim(claimId);
  for (const reference of references) {
    await deleteReference(reference.$id);
  }

  // Finalmente eliminar el claim
  await tablesDB.deleteRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.CLAIMS,
    rowId: claimId,
  });
}

/**
 * Elimina una entidad y todos sus claims asociados
 */
export async function deleteEntity(entityId) {
  // Obtener todos los claims de esta entidad
  const claims = await getClaimsBySubject(entityId);
  
  // Eliminar cada claim (esto también elimina qualifiers y references)
  for (const claim of claims) {
    await deleteClaim(claim.$id);
  }

  // Finalmente eliminar la entidad
  await tablesDB.deleteRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.ENTITIES,
    rowId: entityId,
  });
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

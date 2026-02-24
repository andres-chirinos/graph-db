import { tablesDB, Query } from "./appwrite";
import { DATABASE_ID, TABLES, generatePermissions, stripSystemFields, normalizeText, stringifyClaimValue } from "./db-core";
import { runWithTransaction, createAuditEntry, wrapTransactionResult, updateRowPermissions } from "./db-audit";
import { _searchClaimsBySchemaCondition, getClaim, getClaimsBySubject } from "./db-claims";

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

// Helper to calculate relevance score
function calculateRelevance(entity, term) {
  const normTerm = normalizeText(term);
  const normLabel = normalizeText(entity.label);
  const normDesc = normalizeText(entity.description);
  const normAliases = (entity.aliases || []).map(a => normalizeText(a));
  const normId = normalizeText(entity.$id);

  let score = 0;

  // Exact matches (Highest priority)
  if (normLabel === normTerm) score += 100;
  if (normAliases.includes(normTerm)) score += 90;
  if (normId === normTerm) score += 80;

  // Starts with (High priority)
  if (normLabel.startsWith(normTerm)) score += 60;
  if (normAliases.some(a => a.startsWith(normTerm))) score += 50;

  // Contains (Medium priority)
  if (normLabel.includes(normTerm)) score += 40;
  if (normAliases.some(a => a.includes(normTerm))) score += 30;
  if (normDesc.includes(normTerm)) score += 20;
  if (normId.includes(normTerm)) score += 10;

  return score;
}

/**
 * Busca entidades por texto (label, description, aliases)
 */
export async function searchEntities(searchTerm, limit = 20, offset = 0) {
  let rawTerm = (searchTerm || "").trim();
  let isExactMatch = false;

  if (rawTerm.startsWith('"') && rawTerm.endsWith('"') && rawTerm.length > 2) {
    isExactMatch = true;
    rawTerm = rawTerm.slice(1, -1).trim();
  }

  const term = normalizeText(rawTerm);
  const queries = [
    Query.limit(limit),
    Query.offset(offset),
  ];

  if (searchTerm) {
    if (isExactMatch) {
      // Búsqueda exacta (frase exacta o igualdad)
      queries.push(Query.or([
        Query.equal("label", rawTerm),
        Query.contains("label", rawTerm),
        Query.contains("aliases", rawTerm),
        Query.equal("$id", rawTerm)
      ]));
    } else {
      // Búsqueda flexible
      queries.push(Query.or([
        Query.search("label", term),
        Query.search("description", term),
        Query.contains("aliases", term),
        Query.contains("label", term),
        Query.equal("$id", rawTerm),
      ]));
    }
  } else {
    queries.push(Query.orderDesc("$createdAt"));
  }

  const result = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.ENTITIES,
    queries,
  });

  if (searchTerm && result.rows.length > 0) {
    result.rows.sort((a, b) => {
      const scoreA = calculateRelevance(a, rawTerm);
      const scoreB = calculateRelevance(b, rawTerm);
      return scoreB - scoreA;
    });
  }

  return result;
}

/**
 * Busca entidades que tengan un claim con una propiedad específica y un valor determinado
 * @param {string} propertyId - ID de la propiedad
 * @param {string} value - Valor a buscar (se busca en value_raw como texto)
 * @param {number} limit - Límite de resultados
 * @returns {Promise<Array>} - Lista de entidades que coinciden
 */
export async function searchEntitiesByPropertyValue(propertyId, value, limit = 10, matchMode = "contains") {
  if (!propertyId || !value) return [];

  const searchValue = normalizeText(value);
  const mode = matchMode === "equal" ? "equal" : "contains";

  try {
    const entityIds = new Set();
    const pageSize = 100;
    let offset = 0;

    while (entityIds.size < limit) {
      const claimsResult = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLES.CLAIMS,
        queries: [
          Query.equal("property", propertyId),
          Query.limit(pageSize),
          Query.offset(offset),
        ],
      });

      const rows = claimsResult.rows || [];
      if (rows.length === 0) break;

      for (const claim of rows) {
        const claimValue = normalizeText(stringifyClaimValue(claim.value_raw));
        if (!claimValue || !searchValue) continue;
        if (!claimValue || !searchValue) continue;

        // Numeric comparison helper
        const claimNum = parseFloat(claimValue);
        const condNum = parseFloat(searchValue);
        const isNumeric = !isNaN(claimNum) && !isNaN(condNum);

        let matches = false;
        switch (matchMode) {
          case "equal":
            matches = claimValue === searchValue;
            break;
          case "notEqual":
            matches = claimValue !== searchValue;
            break;
          case "startsWith":
            matches = claimValue.startsWith(searchValue);
            break;
          case "endsWith":
            matches = claimValue.endsWith(searchValue);
            break;
          case "greaterThan":
            matches = isNumeric && claimNum > condNum;
            break;
          case "greaterThanEqual":
            matches = isNumeric && claimNum >= condNum;
            break;
          case "lessThan":
            matches = isNumeric && claimNum < condNum;
            break;
          case "lessThanEqual":
            matches = isNumeric && claimNum <= condNum;
            break;
          case "contains":
          default:
            matches = claimValue.includes(searchValue);
        }
        if (matches) {
          const id = claim.subject?.$id || claim.subject;
          if (id) entityIds.add(id);
        }
        if (entityIds.size >= limit) break;
      }

      if (rows.length < pageSize) break;
      offset += pageSize;
    }

    if (entityIds.size === 0) return [];

    const entities = [];
    for (const id of Array.from(entityIds).slice(0, limit)) {
      try {
        const entity = await tablesDB.getRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.ENTITIES,
          rowId: id,
        });
        if (entity) entities.push(entity);
      } catch (e) {
        console.warn(`Entidad ${id} no encontrada`);
      }
    }

    return entities;
  } catch (err) {
    console.error("Error buscando entidades por propiedad:", err);
    return [];
  }
}

/**
 * Busca entidades usando múltiples condiciones (label/alias + propiedades)
 * @param {Object} conditions - Condiciones de búsqueda
 * @param {string} conditions.text - Texto para buscar en label/alias
 * @param {Array} conditions.properties - Array de {propertyId, value} para buscar por claims
 * @param {number} limit - Límite de resultados
 * @returns {Promise<Array>} - Lista de entidades que coinciden con TODAS las condiciones
 */
export async function searchEntitiesAdvanced(conditions, limit = 10) {
  const { text, properties = [] } = conditions;

  const term = normalizeText(text);
  const conditionIds = [];

  // Condición de texto (label/alias)
  if (term) {
    const pageSize = 50;
    let offset = 0;
    let collected = [];

    while (collected.length < limit * 5) {
      const result = await searchEntities(term, pageSize, offset);
      const rows = result?.rows || [];
      if (rows.length === 0) break;

      const filtered = rows.filter((entity) => {
        const label = normalizeText(entity.label);
        const aliases = Array.isArray(entity.aliases)
          ? entity.aliases.map((a) => normalizeText(a))
          : [];
        return label.includes(term) || aliases.some((a) => a.includes(term));
      });

      collected = collected.concat(filtered);
      if (rows.length < pageSize) break;
      offset += pageSize;
    }

    conditionIds.push(new Set(collected.map((e) => e.$id)));
  }

  // Condiciones por propiedad (AND)
  for (const prop of properties) {
    if (!prop.propertyId || !prop.value) continue;
    const propMatches = await searchEntitiesByPropertyValue(
      prop.propertyId,
      prop.value,
      limit * 10,
      prop.matchMode
    );
    conditionIds.push(new Set(propMatches.map((e) => e.$id)));
  }

  if (conditionIds.length === 0) return [];

  // Intersección AND de todas las condiciones
  let intersection = conditionIds[0];
  for (const nextSet of conditionIds.slice(1)) {
    intersection = new Set([...intersection].filter((id) => nextSet.has(id)));
    if (intersection.size === 0) break;
  }

  const ids = Array.from(intersection).slice(0, limit);
  const entities = [];
  for (const id of ids) {
    try {
      const entity = await tablesDB.getRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.ENTITIES,
        rowId: id,
      });
      if (entity) entities.push(entity);
    } catch (e) {
      console.warn(`Entidad ${id} no encontrada`);
    }
  }

  return entities;
}

/**
 * Searches for entities based on a complex schema definition, which can include text search,
 * direct property-value matches, and nested conditions for claims, qualifiers, and references.
 *
 * @param {EntitySchema} schema - The schema definition to search for.
 * @param {number} limit - The maximum number of entities to return.
 * @param {number} offset - The number of entities to skip (for pagination).
 * @returns {Promise<Array<Object>>} - A list of entities that match the schema.
 */
async function _findEntityIds(schema, limit) {
  const { text, properties = [], claims = [], groups = [], logic = "AND" } = schema;

  let candidateEntityIds = new Set();
  let firstConditionProcessed = false;

  // 1. Process text search condition
  if (text) {
    const textMatches = await searchEntities(text, limit * 5, 0);
    const ids = textMatches.rows.map(entity => entity.$id);
    candidateEntityIds = new Set(ids);
    firstConditionProcessed = true;
  }

  // Helper to merge results based on logic
  const mergeIds = (currentSet, newSet, isFirstInLoop) => {
    if (logic === "AND") {
      if (firstConditionProcessed || !isFirstInLoop) {
        return new Set([...currentSet].filter(id => newSet.has(id)));
      } else {
        return newSet;
      }
    } else { // OR
      return new Set([...currentSet, ...newSet]);
    }
  };

  // 2. Process direct properties conditions
  if (properties.length > 0) {
    let propertyMatchedIds = new Set(firstConditionProcessed ? candidateEntityIds : []);
    let firstProp = true;

    for (const propCondition of properties) {
      if (!propCondition.propertyId || !propCondition.value) continue;
      const propMatches = await searchEntitiesByPropertyValue(
        propCondition.propertyId,
        propCondition.value,
        limit * 5,
        propCondition.matchMode
      );
      const currentPropIds = new Set(propMatches.map(entity => entity.$id));

      propertyMatchedIds = mergeIds(propertyMatchedIds, currentPropIds, firstProp);
      firstProp = false;
    }

    if (!firstProp) { // If we processed at least one valid property
      candidateEntityIds = propertyMatchedIds;
      firstConditionProcessed = true;
    }
  }

  // 3. Process complex claims conditions
  if (claims.length > 0) {
    let claimMatchedIds = new Set(firstConditionProcessed ? candidateEntityIds : []);
    let firstClaim = true;

    for (const claimCondition of claims) {
      const currentClaimSubjectIds = await _searchClaimsBySchemaCondition(claimCondition, limit * 5, 0);
      claimMatchedIds = mergeIds(claimMatchedIds, currentClaimSubjectIds, firstClaim);
      firstClaim = false;
    }

    if (!firstClaim) {
      candidateEntityIds = claimMatchedIds;
      firstConditionProcessed = true;
    }
  }

  // 4. Process nested groups (recursive)
  if (groups.length > 0) {
    let groupMatchedIds = new Set(firstConditionProcessed ? candidateEntityIds : []);
    let firstGroup = true;

    for (const groupSchema of groups) {
      const matchedIds = await _findEntityIds(groupSchema, limit);
      const currentGroupIds = new Set(matchedIds);
      groupMatchedIds = mergeIds(groupMatchedIds, currentGroupIds, firstGroup);
      firstGroup = false;
    }

    if (!firstGroup) {
      candidateEntityIds = groupMatchedIds;
      firstConditionProcessed = true;
    }
  }

  if (!firstConditionProcessed) {
    return [];
  }

  return Array.from(candidateEntityIds);
}

/**
 * Searches for entities based on a complex schema definition.
 * 
 * @param {EntitySchema} schema - The schema definition to search for.
 * @param {number} limit - The maximum number of entities to return.
 * @param {number} offset - The number of entities to skip.
 * @returns {Promise<Array<Object>>} - A list of entities.
 */
export async function searchEntitiesBySchema(schema, limit = 20, offset = 0) {
  // Use the internal helper to find IDs efficiently including groups
  const allIds = await _findEntityIds(schema, limit + offset + 50);

  // Pagination slice
  const pagedIds = allIds.slice(offset, offset + limit);

  const entities = [];
  for (const id of pagedIds) {
    try {
      const entity = await tablesDB.getRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.ENTITIES,
        rowId: id,
      });
      if (entity) entities.push(entity);
    } catch (e) {
      console.warn(`Entidad ${id} no encontrada`);
    }
  }

  return entities;
}

/**
 * Checks a single entity for compliance against a given schema definition.
 * It verifies if the entity matches the schema's text, property, and complex claim conditions.
 *
 * @param {string} entityId - The ID of the entity to check.
 * @param {EntitySchema} schema - The schema definition to check against.
 * @returns {Promise<Object>} - An object indicating compliance status and details.
 */
export async function checkEntitySchemaCompliance(entityId, schema) {
  const { text, properties = [], claims = [], groups = [], logic = "AND" } = schema;

  const entity = await getEntity(entityId, true); // Fetch entity with all relations
  if (!entity) {
    return { isCompliant: false, message: `Entity ${entityId} not found.` };
  }

  const complianceResults = [];

  // 1. Check text search condition
  if (text) {
    const normalizedEntityLabel = normalizeText(entity.label);
    const normalizedEntityDescription = normalizeText(entity.description);
    const normalizedEntityAliases = Array.isArray(entity.aliases)
      ? entity.aliases.map(a => normalizeText(a))
      : [];
    const normalizedSearchTerm = normalizeText(text);

    const textMatch = normalizedEntityLabel.includes(normalizedSearchTerm) ||
      normalizedEntityDescription.includes(normalizedSearchTerm) ||
      normalizedEntityAliases.some(alias => alias.includes(normalizedSearchTerm));
    complianceResults.push(textMatch);
  }

  // 2. Check direct properties conditions
  for (const propCondition of properties) {
    let propertyMatch = false;
    if (entity.claims && Array.isArray(entity.claims)) {
      propertyMatch = entity.claims.some(claim => {
        if (claim.property?.$id === propCondition.propertyId) {
          const rawClaimValue = stringifyClaimValue(claim.value_raw);
          const normalizedClaimValue = normalizeText(rawClaimValue);
          const rawConditionValue = propCondition.value;
          const normalizedConditionValue = normalizeText(rawConditionValue);
          const matchMode = propCondition.matchMode || "contains";

          // Numeric comparison helper
          const claimNum = parseFloat(rawClaimValue);
          const condNum = parseFloat(rawConditionValue);
          const isNumeric = !isNaN(claimNum) && !isNaN(condNum);

          switch (matchMode) {
            case "equal":
              return normalizedClaimValue === normalizedConditionValue;
            case "notEqual":
              return normalizedClaimValue !== normalizedConditionValue;
            case "startsWith":
              return normalizedClaimValue.startsWith(normalizedConditionValue);
            case "endsWith":
              return normalizedClaimValue.endsWith(normalizedConditionValue);
            case "greaterThan":
              return isNumeric && claimNum > condNum;
            case "greaterThanEqual":
              return isNumeric && claimNum >= condNum;
            case "lessThan":
              return isNumeric && claimNum < condNum;
            case "lessThanEqual":
              return isNumeric && claimNum <= condNum;
            case "contains":
            default:
              return normalizedClaimValue.includes(normalizedConditionValue);
          }
        }
        return false;
      });
    }
    complianceResults.push(propertyMatch);
  }

  // 3. Check complex claims conditions
  const claimChecks = claims.map(async (claimCondition) => {
    if (entity.claims && Array.isArray(entity.claims)) {
      for (const claim of entity.claims) {
        // Need to pass full claim object to _claimMatchesSchemaCondition which expects qualifiersList and referencesList
        let fullClaimWithRelations = {
          ...claim,
          qualifiersList: [],
          referencesList: []
        };
        // getClaim already expands these, but the claims in entity.claims might not be fully expanded
        // So, we need to fetch them if the claimCondition has nested rules
        if ((Array.isArray(claimCondition.qualifiers) && claimCondition.qualifiers.length > 0) ||
          (Array.isArray(claimCondition.references) && claimCondition.references.length > 0)) {
          // If there are nested conditions, we must fetch the full claim details
          const fetchedClaim = await getClaim(claim.$id);
          if (fetchedClaim) {
            fullClaimWithRelations = fetchedClaim;
          }
        }
        if (_claimMatchesSchemaCondition(fullClaimWithRelations, claimCondition)) {
          return true; // Found a matching claim for this condition
        }
      }
    }
    return false; // No matching claim found for this condition
  });

  const claimResults = await Promise.all(claimChecks);
  complianceResults.push(...claimResults);

  // 4. Check nested groups (recursive)
  if (groups.length > 0) {
    const groupChecks = groups.map(groupSchema => checkEntitySchemaCompliance(entityId, groupSchema));
    const groupResults = await Promise.all(groupChecks);
    // checkEntitySchemaCompliance returns { isCompliant, ... }
    complianceResults.push(...groupResults.map(r => r.isCompliant));
  }

  let isCompliant;
  if (logic === "AND") {
    isCompliant = complianceResults.every(result => result === true);
  } else { // OR logic
    isCompliant = complianceResults.some(result => result === true);
  }

  return {
    isCompliant,
    details: complianceResults, // Can be refined to show which conditions passed/failed
    entity,
  };
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
 * @param {Object} data - Datos de la entidad
 * @param {string} teamId - ID del team que crea la entidad (opcional)
 */
export async function createEntity(data, teamId = null) {
  const permissions = generatePermissions(teamId);

  return runWithTransaction("createEntity", async (transactionId) => {
    const result = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.ENTITIES,
      rowId: "unique()",
      data: {
        label: data.label || null,
        description: data.description || null,
        aliases: data.aliases || [],
      },
      permissions,
      transactionId,
    });

    const after = stripSystemFields(result);
    await createAuditEntry({
      action: "create",
      tableId: TABLES.ENTITIES,
      rowId: result?.$id,
      before: null,
      after,
      transactionId,
    });

    return wrapTransactionResult(result, [
      { action: "create", table: TABLES.ENTITIES, rowId: result?.$id || "" },
    ]);
  });
}

/**
 * Actualiza una entidad existente
 */
export async function updateEntity(entityId, data) {
  return runWithTransaction("updateEntity", async (transactionId) => {
    const beforeRow = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.ENTITIES,
      rowId: entityId,
    });

    const result = await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.ENTITIES,
      rowId: entityId,
      data,
      transactionId,
    });

    await createAuditEntry({
      action: "update",
      tableId: TABLES.ENTITIES,
      rowId: entityId,
      before: stripSystemFields(beforeRow),
      after: stripSystemFields(result),
      transactionId,
    });

    return wrapTransactionResult(result, [
      { action: "update", table: TABLES.ENTITIES, rowId: entityId },
    ]);
  });
}

/**
 * Actualiza permisos de una entidad
 */
export async function updateEntityPermissions(entityId, permissions) {
  return runWithTransaction("updateEntityPermissions", async (transactionId) => {
    const beforeRow = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.ENTITIES,
      rowId: entityId,
    });

    const result = await updateRowPermissions(TABLES.ENTITIES, entityId, permissions, transactionId);

    await createAuditEntry({
      action: "updatePermissions",
      tableId: TABLES.ENTITIES,
      rowId: entityId,
      before: stripSystemFields(beforeRow),
      after: stripSystemFields(result),
      transactionId,
    });

    return wrapTransactionResult(result, [
      { action: "updatePermissions", table: TABLES.ENTITIES, rowId: entityId },
    ]);
  });
}

/**
 * Elimina una entidad y todos sus claims asociados
 */
export async function deleteEntity(entityId) {
  return runWithTransaction("deleteEntity", async (transactionId) => {
    const changes = [];
    const beforeEntity = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.ENTITIES,
      rowId: entityId,
    });
    // Obtener todos los claims de esta entidad
    const claims = await getClaimsBySubject(entityId);

    // Eliminar cada claim con sus relaciones dentro de la misma transacción
    for (const claim of claims) {
      const qualifiers = await getQualifiersByClaim(claim.$id);
      for (const qualifier of qualifiers) {
        await tablesDB.deleteRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.QUALIFIERS,
          rowId: qualifier.$id,
          transactionId,
        });
        changes.push({ action: "delete", table: TABLES.QUALIFIERS, rowId: qualifier.$id });
      }

      const references = await getReferencesByClaim(claim.$id);
      for (const reference of references) {
        await tablesDB.deleteRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.REFERENCES,
          rowId: reference.$id,
          transactionId,
        });
        changes.push({ action: "delete", table: TABLES.REFERENCES, rowId: reference.$id });
      }

      await tablesDB.deleteRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.CLAIMS,
        rowId: claim.$id,
        transactionId,
      });
      changes.push({ action: "delete", table: TABLES.CLAIMS, rowId: claim.$id });
    }

    // Finalmente eliminar la entidad
    const result = await tablesDB.deleteRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.ENTITIES,
      rowId: entityId,
      transactionId,
    });
    changes.push({ action: "delete", table: TABLES.ENTITIES, rowId: entityId });

    await createAuditEntry({
      action: "delete",
      tableId: TABLES.ENTITIES,
      rowId: entityId,
      before: stripSystemFields(beforeEntity),
      after: null,
      transactionId,
      changes,
    });
    return wrapTransactionResult(result, changes);
  });
}

/**
 * Gets global statistics for the knowledge graph.
 * Returns total counts for Entities, Claims, Qualifiers, and References.
 */
export async function getGlobalStats() {
  try {
    // Run counts in parallel
    const [entities, claims, qualifiers, references] = await Promise.all([
      tablesDB.listRows({ databaseId: DATABASE_ID, tableId: TABLES.ENTITIES, queries: [Query.limit(1)] }),
      tablesDB.listRows({ databaseId: DATABASE_ID, tableId: TABLES.CLAIMS, queries: [Query.limit(1)] }),
      tablesDB.listRows({ databaseId: DATABASE_ID, tableId: TABLES.QUALIFIERS, queries: [Query.limit(1)] }),
      tablesDB.listRows({ databaseId: DATABASE_ID, tableId: TABLES.REFERENCES, queries: [Query.limit(1)] }),
    ]);

    return {
      entityCount: entities.total,
      claimCount: claims.total,
      qualifierCount: qualifiers.total,
      referenceCount: references.total
    };
  } catch (error) {
    console.error("Error fetching global stats:", error);
    return { entityCount: 0, claimCount: 0, qualifierCount: 0, referenceCount: 0 };
  }
}

/**
 * Fetches data for the global graph visualization.
 * Fetches the top N entities (by recent update or other metric) and their connections.
 * 
 * @param {number} limit - Max number of entities to fetch (default 50)
 */
export async function getGlobalGraphData(limit = 50) {
  try {
    // 1. Fetch top entities
    const entitiesRes = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLES.ENTITIES,
      queries: [
        Query.limit(limit),
        Query.orderDesc("$updatedAt") // Get most recently active/updated
      ]
    });

    const entities = entitiesRes.rows;

    // 2. Fetch recent claims to build edges between entities
    const claimsRes = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLES.CLAIMS,
      queries: [
        Query.limit(limit * 3), // Fetch more claims than entities to ensure some connectivity
        Query.orderDesc("$updatedAt"),
        Query.select(["*", "subject.*", "property.*", "value_relation.*"])
      ]
    });

    return {
      entities,
      claims: claimsRes.rows
    };

  } catch (error) {
    console.error("Error fetching global graph data:", error);
    return { entities: [], claims: [] };
  }
}

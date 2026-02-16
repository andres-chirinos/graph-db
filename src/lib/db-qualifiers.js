import { tablesDB, Query } from "./appwrite";
import { DATABASE_ID, TABLES, generatePermissions, normalizeText, stringifyClaimValue, ClaimSchema } from "./db-core";
import { runWithTransaction, createAuditEntry, wrapTransactionResult } from "./db-audit";
// getClaim will be defined in db-claims.js, for now it's a placeholder
import { getClaim } from "./db-claims";

// ============================================
// QUALIFIERS
// ============================================

export async function getQualifiersByEntityRole(entityId, options = {}) {
  const { filters = {}, page = 1, pageSize = 10 } = options;
  const queries = [
    Query.or([
      Query.equal("property", entityId),
      Query.equal("value_relation", entityId),
    ]),
    Query.select(["*", "claim.*", "property.*", "value_relation.*"]),
    Query.offset((page - 1) * pageSize),
    Query.limit(pageSize),
  ];

  if (filters.property) {
    // This filter applies to the property of the qualifier itself
    queries.push(Query.equal("property", filters.property));
  }

  const result = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.QUALIFIERS,
    queries,
  });

  return result.rows;
}

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
      Query.limit(10),
    ],
  });

  return result.rows;
}

/**
 * Crea un nuevo qualifier
 * @param {Object} data - Datos del qualifier
 * @param {string} teamId - ID del team que crea el qualifier (opcional)
 */
export async function createQualifier(data, teamId = null) {
  const permissions = generatePermissions(teamId);
  const datatype = data.datatype ?? (data.value_relation ? "relation" : "string");
  const valueRaw =
    data.value_raw === undefined || data.value_raw === null
      ? null
      : typeof data.value_raw === "string"
        ? data.value_raw
        : JSON.stringify(data.value_raw);

  return runWithTransaction("createQualifier", async (transactionId) => {
    const result = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.QUALIFIERS,
      rowId: "unique()",
      data: {
        claim: data.claim || null,
        property: data.property || null,
        datatype: datatype,
        value_raw: valueRaw,
        value_relation: data.value_relation || null,
      },
      permissions,
      transactionId,
    });

    await createAuditEntry({
      action: "create",
      tableId: TABLES.QUALIFIERS,
      rowId: result?.$id,
      before: null,
      after: stripSystemFields(result),
      transactionId,
    });

    return wrapTransactionResult(result, [
      { action: "create", table: TABLES.QUALIFIERS, rowId: result?.$id || "" },
    ]);
  });
}

/**
 * Actualiza un qualifier existente
 */
export async function updateQualifier(qualifierId, data) {
  const updateData = {};
  if (data.property !== undefined) updateData.property = data.property;
  if (data.datatype !== undefined) {
    updateData.datatype = data.datatype ?? (data.value_relation ? "relation" : "string");
  } else if (data.value_relation !== undefined) {
    updateData.datatype = "relation";
  }
  if (data.value_raw !== undefined) {
    updateData.value_raw =
      data.value_raw === null || data.value_raw === undefined
        ? null
        : typeof data.value_raw === "string"
          ? data.value_raw
          : JSON.stringify(data.value_raw);
  }
  if (data.value_relation !== undefined) updateData.value_relation = data.value_relation;

  return runWithTransaction("updateQualifier", async (transactionId) => {
    const beforeRow = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.QUALIFIERS,
      rowId: qualifierId,
    });

    const result = await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.QUALIFIERS,
      rowId: qualifierId,
      data: updateData,
      transactionId,
    });

    await createAuditEntry({
      action: "update",
      tableId: TABLES.QUALIFIERS,
      rowId: qualifierId,
      before: stripSystemFields(beforeRow),
      after: stripSystemFields(result),
      transactionId,
    });

    return wrapTransactionResult(result, [
      { action: "update", table: TABLES.QUALIFIERS, rowId: qualifierId },
    ]);
  });
}

/**
 * Actualiza permisos de un qualifier
 */
export async function updateQualifierPermissions(qualifierId, permissions) {
  return runWithTransaction("updateQualifierPermissions", async (transactionId) => {
    const beforeRow = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.QUALIFIERS,
      rowId: qualifierId,
    });

    const result = await updateRowPermissions(TABLES.QUALIFIERS, qualifierId, permissions, transactionId);

    await createAuditEntry({
      action: "updatePermissions",
      tableId: TABLES.QUALIFIERS,
      rowId: qualifierId,
      before: stripSystemFields(beforeRow),
      after: stripSystemFields(result),
      transactionId,
    });

    return wrapTransactionResult(result, [
      { action: "updatePermissions", table: TABLES.QUALIFIERS, rowId: qualifierId },
    ]);
  });
}

/**
 * Elimina un qualifier
 */
export async function deleteQualifier(qualifierId) {
  return runWithTransaction("deleteQualifier", async (transactionId) => {
    const beforeRow = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.QUALIFIERS,
      rowId: qualifierId,
    });

    const result = await tablesDB.deleteRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.QUALIFIERS,
      rowId: qualifierId,
      transactionId,
    });

    await createAuditEntry({
      action: "delete",
      tableId: TABLES.QUALIFIERS,
      rowId: qualifierId,
      before: stripSystemFields(beforeRow),
      after: null,
      transactionId,
    });

    return wrapTransactionResult(result, [
      { action: "delete", table: TABLES.QUALIFIERS, rowId: qualifierId },
    ]);
  });
}

import { tablesDB, Query } from "./appwrite";
import { DATABASE_ID, TABLES, generatePermissions } from "./db-core";
import { runWithTransaction, createAuditEntry, wrapTransactionResult } from "./db-audit";

// ============================================
// REFERENCES
// ============================================

/**
 * Obtiene las referencias donde una entidad es usada como referencia (reference).
 * @param {string} entityId - ID de la entidad.
 * @param {Object} options - { filters: {claim}, page, pageSize } // Claim filter added for consistency, though not strictly needed for direct entity reference.
 * @returns {Promise<Array>}
 */
export async function getReferencesByEntityRole(entityId, options = {}) {
  const { filters = {}, page = 1, pageSize = 10 } = options;
  const queries = [
    Query.equal("reference", entityId),
    Query.select(["*", "claim.*", "reference.*"]),
    Query.offset((page - 1) * pageSize),
    Query.limit(pageSize),
  ];

  if (filters.claim) {
    // This filter applies to the claim of the reference
    queries.push(Query.equal("claim", filters.claim));
  }

  const result = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.REFERENCES,
    queries,
  });

  return result.rows;
}

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
      Query.limit(10),
    ],
  });

  return result.rows;
}

/**
 * Crea una nueva referencia
 * @param {Object} data - Datos de la referencia
 * @param {string} teamId - ID del team que crea la referencia (opcional)
 */
export async function createReference(data, teamId = null) {
  const permissions = generatePermissions(teamId);

  return runWithTransaction("createReference", async (transactionId) => {
    const result = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.REFERENCES,
      rowId: "unique()",
      data: {
        claim: data.claim || null,
        details: data.details || null,
        reference: data.reference || null,
      },
      permissions,
      transactionId,
    });

    await createAuditEntry({
      action: "create",
      tableId: TABLES.REFERENCES,
      rowId: result?.$id,
      before: null,
      after: stripSystemFields(result),
      transactionId,
    });

    return wrapTransactionResult(result, [
      { action: "create", table: TABLES.REFERENCES, rowId: result?.$id || "" },
    ]);
  });
}

/**
 * Actualiza una referencia existente
 */
export async function updateReference(referenceId, data) {
  const updateData = {};
  if (data.details !== undefined) updateData.details = data.details;
  if (data.reference !== undefined) updateData.reference = data.reference;

  return runWithTransaction("updateReference", async (transactionId) => {
    const beforeRow = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.REFERENCES,
      rowId: referenceId,
    });

    const result = await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.REFERENCES,
      rowId: referenceId,
      data: updateData,
      transactionId,
    });

    await createAuditEntry({
      action: "update",
      tableId: TABLES.REFERENCES,
      rowId: referenceId,
      before: stripSystemFields(beforeRow),
      after: stripSystemFields(result),
      transactionId,
    });

    return wrapTransactionResult(result, [
      { action: "update", table: TABLES.REFERENCES, rowId: referenceId },
    ]);
  });
}

/**
 * Actualiza permisos de una referencia
 */
export async function updateReferencePermissions(referenceId, permissions) {
  return runWithTransaction("updateReferencePermissions", async (transactionId) => {
    const beforeRow = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.REFERENCES,
      rowId: referenceId,
    });

    const result = await updateRowPermissions(TABLES.REFERENCES, referenceId, permissions, transactionId);

    await createAuditEntry({
      action: "updatePermissions",
      tableId: TABLES.REFERENCES,
      rowId: referenceId,
      before: stripSystemFields(beforeRow),
      after: stripSystemFields(result),
      transactionId,
    });

    return wrapTransactionResult(result, [
      { action: "updatePermissions", table: TABLES.REFERENCES, rowId: referenceId },
    ]);
  });
}

/**
 * Elimina una referencia
 */
export async function deleteReference(referenceId) {
  return runWithTransaction("deleteReference", async (transactionId) => {
    const beforeRow = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.REFERENCES,
      rowId: referenceId,
    });

    const result = await tablesDB.deleteRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.REFERENCES,
      rowId: referenceId,
      transactionId,
    });

    await createAuditEntry({
      action: "delete",
      tableId: TABLES.REFERENCES,
      rowId: referenceId,
      before: stripSystemFields(beforeRow),
      after: null,
      transactionId,
    });

    return wrapTransactionResult(result, [
      { action: "delete", table: TABLES.REFERENCES, rowId: referenceId },
    ]);
  });
}

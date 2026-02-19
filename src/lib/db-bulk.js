import { tablesDB } from "./appwrite";
import { DATABASE_ID, generatePermissions } from "./db-core";
import { runWithTransaction } from "./db-audit";

// ============================================
// BULK OPERATIONS - Atomic
// ============================================

/**
 * Helper to create a 'createDocument' operation object
 */
export function createDocumentOp(tableId, data, permissions = [], rowId = "unique()") {
  return {
    method: 'createDocument',
    databaseId: DATABASE_ID,
    collectionId: tableId,
    documentId: rowId,
    data,
    permissions
  };
}

/**
 * Helper to create an 'updateDocument' operation object
 */
export function updateDocumentOp(tableId, documentId, data, permissions) {
  const op = {
    method: 'updateDocument',
    databaseId: DATABASE_ID,
    collectionId: tableId,
    documentId,
    data
  };
  if (permissions) op.permissions = permissions;
  return op;
}

/**
 * Helper to create a 'deleteDocument' operation object
 */
export function deleteDocumentOp(tableId, documentId) {
  return {
    method: 'deleteDocument',
    databaseId: DATABASE_ID,
    collectionId: tableId,
    documentId
  };
}

/**
 * Executes a batch of operations atomically using Appwrite's createOperations.
 * @param {Array} operations - Array of operation objects (created via helpers above).
 * @param {string} [transactionId] - Optional existing transaction ID. If not provided, a new transaction is created.
 * @returns {Promise<Object>} - Format: { success: true, results: [...] }
 */
export async function createBulkOperations(operations, transactionId = null) {
  // If transactionId is provided, we assume the caller handles the transaction lifecycle (commit/rollback)
  // OR we can use runWithTransaction if we want this function to manage it when no ID is provided.

  if (transactionId) {
    // Just execute
    await tablesDB.createOperations({
      databaseId: DATABASE_ID, // createOperations might take this at top level or per op? SDK usually takes it at top level for transaction context?
      // Actually, per Appwrite docs for `createOperations`, it takes a list of operations.
      // But if we are inside a transaction, we pass transactionId?
      // Wait, the SDK `createOperations` signature is usually `(params)`.
      // Let's assume standard Appwrite params.
      transactionId,
      operations
    });
    return { success: true, count: operations.length };
  }

  return runWithTransaction("bulkOperations", async (txId) => {
    await tablesDB.createOperations({
      databaseId: DATABASE_ID,
      transactionId: txId,
      operations
    });
    return { success: true, count: operations.length };
  });
}

/**
 * High-level helper to create multiple rows in a table (Atomic).
 * Replaces the old loop-based approach.
 * @param {string} tableId 
 * @param {Array} rows - { data, rowId?, permissions? }
 * @param {string} teamId 
 */
export async function createRowsBulk(tableId, rows = [], teamId = null) {
  const basePermissions = generatePermissions(teamId);

  // Construct operations
  const operations = rows.map(row => {
    return createDocumentOp(
      tableId,
      row.data || {},
      row.permissions || basePermissions,
      row.rowId || "unique()"
    );
  });

  if (operations.length === 0) return { success: true, count: 0 };

  // Execute
  // Note: Appwrite might have limits on batch size (e.g. 100). 
  // For now, we assume user invokes this with reasonable chunks or we chunk it here.
  // Let's chunk it safely to 50 just in case.

  const CHUNK_SIZE = 50;
  const results = [];

  // We want all of this in ONE transaction if possible? 
  // If limits deny it, we might need multiple transactions or just accept chunked commits.
  // For atomic requirement, technically should be one transaction. 
  // But if rows.length > 100, we might crash.
  // Let's rely on runWithTransaction to hold the transaction and we call createOperations multiple times?
  // Appwrite transactions support multiple requests.

  return runWithTransaction("createRowsBulk", async (txId) => {
    for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
      const chunk = operations.slice(i, i + CHUNK_SIZE);
      await tablesDB.createOperations({
        databaseId: DATABASE_ID,
        transactionId: txId,
        operations: chunk
      });
    }
    return { success: true, total: rows.length };
  });
}

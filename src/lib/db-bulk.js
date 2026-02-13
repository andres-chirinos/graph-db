import { tablesDB } from "./appwrite";
import { DATABASE_ID, generatePermissions } from "./db-core";
import { runWithTransaction } from "./db-audit";

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Crea múltiples rows en una tabla
 * @param {string} tableId - ID de la tabla
 * @param {Array} rows - Array de { data, rowId?, permissions? }
 * @param {string} teamId - ID del team (opcional)
 * @param {Object} options - { continueOnError?: boolean }
 */
export async function createRowsBulk(tableId, rows = [], teamId = null, options = {}) {
  const { continueOnError = true } = options;
  const basePermissions = generatePermissions(teamId);

  return runWithTransaction("createRowsBulk", async (transactionId) => {
    if (typeof tablesDB.createRows === "function") {
      const data = (rows || []).map((row) => ({
        ...(row?.data || {}),
        rowId: row?.rowId || "unique()",
        permissions: row?.permissions || basePermissions,
      }));
      // Assuming createRows can take a transactionId
      return tablesDB.createRows({
        databaseId: DATABASE_ID,
        tableId,
        data,
        continueOnError,
        transactionId,
      });
    } else {
      // Fallback for older Appwrite SDKs or if createRows is not available
      const results = [];
      for (const row of rows) {
        try {
          const result = await tablesDB.createRow({
            databaseId: DATABASE_ID,
            tableId,
            rowId: row?.rowId || "unique()",
            data: row?.data || {},
            permissions: row?.permissions || basePermissions,
            transactionId,
          });
          results.push(result);
        } catch (error) {
          console.error(`Error creating row in bulk for table ${tableId}:`, error);
          if (!continueOnError) {
            throw error;
          }
          results.push({ error: error.message, rowData: row?.data });
        }
      }
      return { rows: results, total: results.length };
    }
  });
}

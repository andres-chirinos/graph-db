import { tablesDB, Permission, Role, Query } from "./appwrite";
import { getCurrentUser } from "./auth";
import { DATABASE_ID, stripSystemFields } from "./db-core";

export const AUDIT_TABLE_ID = process.env.APPWRITE_AUDIT_TABLE_ID || process.env.NEXT_PUBLIC_AUDIT_TABLE_ID;
export const MAIN_TEAM_ID = process.env.MAIN_TEAM_ID || process.env.NEXT_PUBLIC_MAIN_TEAM_ID;

const TRANSACTION_LOG_KEY = "graphdb_transaction_logs";

export function wrapTransactionResult(result, changes = []) {
  return { __changes: changes, result };
}

export function getLocalTransactionLogs() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TRANSACTION_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn("[DB] Failed to read transaction logs:", error);
    return [];
  }
}

export function saveLocalTransactionLogs(logs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TRANSACTION_LOG_KEY, JSON.stringify(logs));
  } catch (error) {
    console.warn("[DB] Failed to save transaction logs:", error);
  }
}

export function addLocalTransactionLog(entry) {
  const logs = getLocalTransactionLogs();
  const next = [entry, ...logs].slice(0, 200);
  saveLocalTransactionLogs(next);
}

export function listLocalTransactionLogs() {
  return getLocalTransactionLogs();
}

export function isAuditEnabled() {
  return !!AUDIT_TABLE_ID;
}

export function buildAuditPermissions() {
  if (MAIN_TEAM_ID) {
    return [
      Permission.read(Role.team(MAIN_TEAM_ID)),
      Permission.update(Role.team(MAIN_TEAM_ID)),
      Permission.delete(Role.team(MAIN_TEAM_ID)),
    ];
  }
  return undefined;
}

export async function createAuditEntry({
  action,
  tableId,
  rowId,
  before,
  after,
  status = "pending",
  transactionId,
  changes,
  note,
  relatedAuditId,
}) {
  if (!isAuditEnabled()) return null;

  const user = await getCurrentUser();
  const permissions = buildAuditPermissions();

  return tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: AUDIT_TABLE_ID,
    rowId: "unique()",
    data: {
      action,
      tableId,
      rowId,
      before: before ?? null,
      after: after ?? null,
      status,
      transactionId: transactionId || null,
      changes: changes || [],
      userId: user?.$id || null,
      userEmail: user?.email || null,
      note: note || null,
      relatedAuditId: relatedAuditId || null,
    },
    permissions,
  });
}

export async function updateRowPermissions(tableId, rowId, permissions, transactionId = null) {
  const row = await tablesDB.getRow({
    databaseId: DATABASE_ID,
    tableId,
    rowId,
  });
  const data = stripSystemFields(row);
  return tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId,
    rowId,
    data,
    permissions,
    transactionId: transactionId || undefined,
  });
}

export async function runWithTransaction(label, handler) {
  const tx = await tablesDB.createTransaction();
  console.log(`[DB] Transaction started: ${tx.$id} - ${label}`);
  try {
    const output = await handler(tx.$id);
    const changes = output?.__changes || [];
    const result = output?.__changes ? output.result : output;
    await tablesDB.updateTransaction({
      transactionId: tx.$id,
      commit: true,
    });
    console.log(`[DB] Transaction committed: ${tx.$id} - ${label}`);
    addLocalTransactionLog({
      id: tx.$id,
      label,
      status: "committed",
      createdAt: new Date().toISOString(),
      changes,
    });
    return result;
  } catch (error) {
    try {
      await tablesDB.updateTransaction({
        transactionId: tx.$id,
        rollback: true,
      });
      console.log(`[DB] Transaction rolled back: ${tx.$id} - ${label}`);
      addLocalTransactionLog({
        id: tx.$id,
        label,
        status: "rolledback",
        createdAt: new Date().toISOString(),
        changes: [],
      });
    } catch (rollbackError) {
      console.error("[DB] Transaction rollback failed:", rollbackError);
    }
    throw error;
  }
}

/**
 * Crea una nueva transacción (explicita)
 */
export async function createTransaction() {
  const tx = await tablesDB.createTransaction();
  return tx;
}

/**
 * Confirma una transacción (explicita)
 */
export async function commitTransaction(transactionId) {
  await tablesDB.updateTransaction({
    transactionId,
    commit: true,
  });
}

/**
 * Revierte una transacción (explicita)
 */
export async function rollbackTransaction(transactionId) {
  await tablesDB.updateTransaction({
    transactionId,
    rollback: true,
  });
}

/**
 * Ejecuta múltiples operaciones en una transacción
 */
export async function executeInTransaction(operations) {
  const tx = await createTransaction();

  try {
    await tablesDB.createOperations({
      transactionId: tx.$id,
      operations,
    });

    await commitTransaction(tx.$id);
    return { success: true, transactionId: tx.$id };
  } catch (e) {
    await rollbackTransaction(tx.$id);
    throw e;
  }
}

/**
 * Lista transacciones
 */
export async function listTransactions(filters = {}) {
  if (typeof tablesDB.listTransactions !== "function") return [];
  const {
    status,
    from,
    to,
    limit,
    offset,
    queries: extraQueries = [],
  } = filters || {};
  const queries = [...(extraQueries || [])];

  if (status && status !== "all") {
    queries.push(Query.equal("status", status));
  }

  const gt = Query.greaterThanEqual || Query.greaterThan;
  const lt = Query.lessThanEqual || Query.lessThan;

  if (from && gt) {
    queries.push(gt("$createdAt", from));
  }
  if (to && lt) {
    queries.push(lt("$createdAt", to));
  }
  if (limit) queries.push(Query.limit(limit));
  if (offset) queries.push(Query.offset(offset));

  const result = await tablesDB.listTransactions({ queries });
  return result?.transactions || result?.items || [];
}

/**
 * Lista auditoría de cambios
 */
export async function listAuditEntries(filters = {}) {
  if (!isAuditEnabled()) return [];
  const {
    status,
    from,
    to,
    limit,
    offset,
    tableId,
    userId,
    queries: extraQueries = [],
  } = filters || {};
  const queries = [...(extraQueries || [])];

  if (status && status !== "all") {
    queries.push(Query.equal("status", status));
  }
  if (tableId && tableId !== "all") {
    queries.push(Query.equal("tableId", tableId));
  }
  if (userId) {
    queries.push(Query.equal("userId", userId));
  }

  const gt = Query.greaterThanEqual || Query.greaterThan;
  const lt = Query.lessThanEqual || Query.lessThan;

  if (from && gt) queries.push(gt("$createdAt", from));
  if (to && lt) queries.push(lt("$createdAt", to));
  if (limit) queries.push(Query.limit(limit));
  if (offset) queries.push(Query.offset(offset));

  const result = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: AUDIT_TABLE_ID,
    queries,
  });

  return result?.rows || [];
}

/**
 * Aprueba una auditoría (marca status)
 */
export async function approveAuditEntry(auditId, note) {
  if (!isAuditEnabled()) return null;
  return tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: AUDIT_TABLE_ID,
    rowId: auditId,
    data: {
      status: "approved",
      note: note || null,
      reviewedAt: new Date().toISOString(),
    },
  });
}

/**
 * Rechaza una auditoría (marca status)
 */
export async function rejectAuditEntry(auditId, note) {
  if (!isAuditEnabled()) return null;
  return tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: AUDIT_TABLE_ID,
    rowId: auditId,
    data: {
      status: "rejected",
      note: note || null,
      reviewedAt: new Date().toISOString(),
    },
  });
}

/**
 * Aplica rollback basado en auditoría
 */
export async function rollbackAuditEntry(auditEntry, note) {
  if (!auditEntry) throw new Error("Auditoría inválida");

  const { action, tableId, rowId, before, after } = auditEntry;

  return runWithTransaction("rollbackAuditEntry", async (transactionId) => {
    let result = null;

    if (action === "create") {
      result = await tablesDB.deleteRow({
        databaseId: DATABASE_ID,
        tableId,
        rowId,
        transactionId,
      });
    } else if (action === "update" || action === "updatePermissions") {
      if (!before) throw new Error("No hay estado previo para revertir");
      result = await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId,
        rowId,
        data: before,
        transactionId,
      });
    } else if (action === "delete") {
      if (!before) throw new Error("No hay estado previo para restaurar");
      result = await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId,
        rowId: rowId || "unique()",
        data: before,
        transactionId,
      });
    } else {
      throw new Error("Rollback no soportado para esta acción");
    }

    await createAuditEntry({
      action: "rollback",
      tableId,
      rowId,
      before: after || null,
      after: before || null,
      status: "approved",
      transactionId,
      note: note || null,
      relatedAuditId: auditEntry.$id,
    });

    return result;
  });
}

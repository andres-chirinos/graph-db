import { tablesDB, Permission, Role } from "./appwrite";
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

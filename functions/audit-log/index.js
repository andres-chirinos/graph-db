const sdk = require("node-appwrite");

const DATABASE_ID =
  process.env.APPWRITE_DATABASE_ID ||
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;

const TABLES = {
  ENTITIES: process.env.APPWRITE_ENTITIES_TABLE_ID || "entities",
  CLAIMS: process.env.APPWRITE_CLAIMS_TABLE_ID || "claims",
  QUALIFIERS: process.env.APPWRITE_QUALIFIERS_TABLE_ID || "qualifiers",
  REFERENCES: process.env.APPWRITE_REFERENCES_TABLE_ID || "references",
};

const AUDIT_LOG_TABLE =
  process.env.APPWRITE_AUDIT_LOG_TABLE_ID || "audit_log";

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "object") return body;
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function safeStringify(value, maxLength) {
  try {
    const json = JSON.stringify(value);
    if (!maxLength) return json;
    return json.length > maxLength ? json.slice(0, maxLength) : json;
  } catch {
    return null;
  }
}

function pickPreviousData(body) {
  return (
    body?.previous ||
    body?.before ||
    body?.old ||
    body?.payload?.previous ||
    body?.payload?.before ||
    null
  );
}

function extractEventName(req, body) {
  return (
    req?.headers?.["x-appwrite-event"] ||
    req?.headers?.["X-Appwrite-Event"] ||
    body?.event ||
    body?.events?.[0] ||
    null
  );
}

function extractCollectionId(payload, eventName) {
  if (payload?.$collectionId) return payload.$collectionId;
  if (payload?.$tableId) return payload.$tableId;
  if (!eventName) return null;

  const collectionMatch = eventName.match(/collections\.([^\.]+)\./);
  if (collectionMatch) return collectionMatch[1];

  const tableMatch = eventName.match(/tables\.([^\.]+)\./);
  if (tableMatch) return tableMatch[1];

  return null;
}

function extractDocumentId(payload, eventName) {
  if (payload?.$id) return payload.$id;
  if (!eventName) return null;

  const documentMatch = eventName.match(/documents\.([^\.]+)\./);
  if (documentMatch) return documentMatch[1];

  const rowMatch = eventName.match(/rows\.([^\.]+)\./);
  if (rowMatch) return rowMatch[1];

  return null;
}

function getAction(eventName) {
  if (!eventName) return null;
  if (eventName.includes(".create")) return "create";
  if (eventName.includes(".update")) return "update";
  if (eventName.includes(".delete")) return "delete";
  return null;
}

function toEntityType(collectionId) {
  switch (collectionId) {
    case TABLES.ENTITIES:
      return "entity";
    case TABLES.CLAIMS:
      return "claim";
    case TABLES.QUALIFIERS:
      return "qualifier";
    case TABLES.REFERENCES:
      return "reference";
    default:
      return null;
  }
}

function stripSystemFields(data) {
  if (!data || typeof data !== "object") return data;
  const output = { ...data };
  const systemFields = [
    "$id",
    "$createdAt",
    "$updatedAt",
    "$permissions",
    "$databaseId",
    "$tableId",
    "$collectionId",
  ];

  for (const key of systemFields) {
    if (key in output) delete output[key];
  }

  return output;
}

function getEntityLabel(data) {
  if (!data || typeof data !== "object") return null;
  return (
    data.label ||
    data.name ||
    data.title ||
    data.displayName ||
    data.value ||
    null
  );
}

function isEntityRef(data) {
  if (!data || typeof data !== "object") return false;
  if (!data.$id) return false;
  return Boolean(getEntityLabel(data));
}

function reduceRelatedEntities(data, depth = 0) {
  if (data == null) return data;
  if (Array.isArray(data)) {
    return data.map((item) => reduceRelatedEntities(item, depth + 1));
  }
  if (typeof data !== "object") return data;

  if (depth > 0 && isEntityRef(data)) {
    const label = getEntityLabel(data);
    return {
      $id: data.$id,
      label: label,
    };
  }

  const output = {};
  for (const [key, value] of Object.entries(data)) {
    output[key] = reduceRelatedEntities(value, depth + 1);
  }
  return output;
}

function getApiKey(headers) {
  return (
    process.env.APPWRITE_API_KEY ||
    process.env.NEXT_PUBLIC_APPWRITE_API_KEY ||
    process.env.APPWRITE_FUNCTION_API_KEY ||
    headers["x-appwrite-key"]
  );
}

function extractUserInfo(req, body) {
  const headers = req?.headers || {};
  const userId =
    body?.userId ||
    body?.user?.$id ||
    headers["x-appwrite-user-id"] ||
    headers["X-Appwrite-User-Id"] ||
    null;

  const userEmail =
    body?.user?.email ||
    headers["x-appwrite-user-email"] ||
    headers["X-Appwrite-User-Email"] ||
    null;

  const userName =
    body?.user?.name ||
    userEmail ||
    headers["x-appwrite-user-name"] ||
    headers["X-Appwrite-User-Name"] ||
    null;

  return { userId, userName, userEmail };
}

function extractTransactionId(req, body, payload) {
  return (
    body?.transactionId ||
    body?.transaction?.$id ||
    payload?.transactionId ||
    payload?.$transactionId ||
    req?.headers?.["x-appwrite-transaction-id"] ||
    req?.headers?.["X-Appwrite-Transaction-Id"] ||
    null
  );
}

module.exports = async ({ req, res, log, error }) => {
  try {
    log("audit-log: start");
    log(`audit-log: headers=${JSON.stringify(req?.headers || {})}`);
    log(`audit-log: rawBodyType=${typeof req?.body}`);
    log(`audit-log: rawBody=${typeof req?.body === "string" ? req.body : JSON.stringify(req?.body || {})}`);

    const body = parseBody(req?.body);
    log(`audit-log: parsedBody=${JSON.stringify(body)}`);
    const eventName = extractEventName(req, body);
    const action = getAction(eventName);
    log(`audit-log: eventName=${eventName} action=${action}`);

    const payload = body?.payload || body?.data || body?.document || null;
    const collectionId = extractCollectionId(payload, eventName);
    log(`audit-log: collectionId=${collectionId}`);

    if (!DATABASE_ID || !collectionId || !action) {
      log("audit-log: skipped missing database, collection or action");
      return res.json({
        ok: false,
        skipped: true,
        reason: "missing database, collection or action",
      });
    }

    if (collectionId === AUDIT_LOG_TABLE) {
      log("audit-log: skipped audit log collection");
      return res.json({ ok: true, skipped: true, reason: "audit log" });
    }

    const entityType = toEntityType(collectionId);
    if (!entityType) {
      log("audit-log: skipped untracked collection");
      return res.json({
        ok: true,
        skipped: true,
        reason: "untracked collection",
      });
    }

    const entityId = extractDocumentId(payload, eventName);
    log(`audit-log: entityType=${entityType} entityId=${entityId}`);

    const { userId, userName, userEmail } = extractUserInfo(req, body);
    const transactionId = extractTransactionId(req, body, payload);
    log(`audit-log: userId=${userId} userName=${userName} userEmail=${userEmail}`);
    log(`audit-log: transactionId=${transactionId}`);


    const previousData = reduceRelatedEntities(pickPreviousData(body) || body) || null;
    log(`audit-log: previousData=${previousData ? "present" : "null"}`);

    const endpoint =
      process.env.APPWRITE_ENDPOINT ||
      process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId =
      process.env.APPWRITE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    const apiKey = getApiKey(req?.headers || {});

    if (!endpoint || !projectId || !apiKey) {
      log("audit-log: missing endpoint/project/apiKey");
      return res.json({
        ok: false,
        skipped: true,
        reason: "missing Appwrite endpoint, project, or api key",
      });
    }

    const client = new sdk.Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);

    //const userJwt = req?.headers?.["x-appwrite-user-jwt"];
    //if (userJwt) {
    //  client.setJWT(userJwt);
    //} else if (process.env.APPWRITE_API_KEY) {
    //  client.setKey(process.env.APPWRITE_API_KEY);
    //}

    const tablesDB = new sdk.TablesDB(client);

    log("audit-log: writing audit row");
    const previousDataString = safeStringify(previousData, 10240);
    const newDataString = safeStringify(payload, 1024);
    const metadataString = safeStringify({
      event: eventName,
      collectionId,
      entityId,
      functionId: process.env.APPWRITE_FUNCTION_ID || null,
      transactionId,
      userId,
      userName,
      userEmail,
    }, 1024);

    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: AUDIT_LOG_TABLE,
      rowId: "unique()",
      data: {
        action,
        entity_type: entityType,
        entity_id: entityId,
        user_id: userId,
        user_name: userName,
        previous_data: previousDataString || null,
        new_data: newDataString || null,
        metadata: metadataString || null,
      },
    });
    log("audit-log: write successful");

    return res.json({ ok: true });
  } catch (err) {
    error(`audit-log: error=${String(err)}`);
    return res.json({ ok: false, error: String(err) }, 500);
  }
};

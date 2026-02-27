import { functions } from "./appwrite";

export const FUNCTIONS = {
    IMPORT: process.env.NEXT_PUBLIC_IMPORT_FUNCTION_ID || "import-data",
    QUERY: process.env.NEXT_PUBLIC_QUERY_FUNCTION_ID || "query",
};

/**
 * Execute an Appwrite function by ID
 * @param {string} functionId - Function ID (e.g. "import-data")
 * @param {object} body - Request body (will be JSON.stringify'd)
 * @param {string} method - HTTP method (default: "POST")
 * @returns {Promise<object>} Parsed response from the function
 */
export async function executeFunction(functionId, body = {}, method = "POST") {
    const execution = await functions.createExecution({
        functionId,
        body: typeof body === "string" ? body : JSON.stringify(body),
        method,
        headers: { "Content-Type": "application/json" },
    });

    try {
        return JSON.parse(execution.responseBody);
    } catch {
        return { error: execution.responseBody || "Error desconocido", raw: execution };
    }
}

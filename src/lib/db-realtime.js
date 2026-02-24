import { client } from "./appwrite";
import { DATABASE_ID, TABLES } from "./db-core";

/**
 * Suscribe a los eventos en tiempo real de una colección completa
 * @param {string} collectionId - ID de la colección (e.g. TABLES.ENTITIES)
 * @param {function} callback - Función callback para procesar la actualización
 * @returns {function} Función para desuscribirse
 */
export function subscribeToCollection(collectionId, callback) {
    const channel = `databases.${DATABASE_ID}.collections.${collectionId}.documents`;
    console.log("[Realtime] Subscribing to collection channel:", channel);
    return client.subscribe(channel, (response) => {
        console.log(`[Realtime - ${collectionId}] Event received:`, response);
        callback(response);
    });
}

/**
 * Suscribe a los eventos en tiempo real de un documento específico
 * @param {string} collectionId - ID de la colección
 * @param {string} documentId - ID del documento
 * @param {function} callback - Función callback para procesar la actualización
 * @returns {function} Función para desuscribirse
 */
export function subscribeToDocument(collectionId, documentId, callback) {
    const channel = `databases.${DATABASE_ID}.collections.${collectionId}.documents.${documentId}`;
    console.log("[Realtime] Subscribing to document channel:", channel);
    return client.subscribe(channel, (response) => {
        console.log(`[Realtime - ${collectionId}/${documentId}] Event received:`, response);
        callback(response);
    });
}

/**
 * Suscribe a múltiples colecciones simultáneamente
 * @param {string[]} collectionIds - IDs de las colecciones
 * @param {function} callback - Función callback
 * @returns {function} Función para desuscribirse
 */
export function subscribeToCollections(collectionIds, callback) {
    const channels = collectionIds.map(
        (id) => `databases.${DATABASE_ID}.collections.${id}.documents`
    );
    console.log("[Realtime] Subscribing to multiple channels:", channels);
    return client.subscribe(channels, (response) => {
        console.log(`[Realtime - Multi] Event received:`, response);
        callback(response);
    });
}

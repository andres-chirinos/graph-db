import { Permission, Role, storage, ID } from "./appwrite";

// Configuración de buckets para diferentes tipos de datos
export const BUCKETS = {
  IMAGES: process.env.NEXT_PUBLIC_BUCKET_IMAGES || "images",
  GEOJSON: process.env.NEXT_PUBLIC_BUCKET_GEOJSON || "geojson",
  JSON: process.env.NEXT_PUBLIC_BUCKET_JSON || "json",
  FILES: process.env.NEXT_PUBLIC_BUCKET_FILES || "files",
};

/**
 * Obtiene el bucketId según el datatype
 * @param {string} datatype - Tipo de dato
 */
export function getBucketIdForDatatype(datatype) {
  const type = String(datatype || "").toLowerCase();

  if (["image", "photo", "picture", "media"].includes(type)) {
    return BUCKETS.IMAGES;
  }

  if (["geojson", "polygon", "multipolygon", "linestring", "geometry"].includes(type)) {
    return BUCKETS.GEOJSON;
  }

  if (type === "json") {
    return BUCKETS.JSON;
  }

  return BUCKETS.FILES;
}

/**
 * Genera los permisos para un archivo basándose en el team
 * @param {string} teamId - ID del team que crea el archivo
 * @returns {string[]} Array de permisos de Appwrite
 */
function generatePermissions(teamId) {
  const permissions = [];

  if (teamId) {
    permissions.push(Permission.update(Role.team(teamId)));
    permissions.push(Permission.delete(Role.team(teamId)));
  }

  return permissions;
}

/**
 * Sube un archivo a un bucket específico
 * @param {string} bucketId - ID del bucket
 * @param {File|Blob} file - Archivo a subir
 * @param {string} filename - Nombre del archivo (opcional)
 * @param {string} teamId - ID del team para permisos (opcional)
 * @returns {Object} - Resultado con fileId y URL
 */
export async function uploadFile(bucketId, file, filename = null, teamId = null) {
  const permissions = generatePermissions(teamId);

  const result = await storage.createFile(
    bucketId,
    ID.unique(),
    file,
    permissions.length > 0 ? permissions : undefined
  );

  const fileUrl = storage.getFileView(bucketId, result.$id);

  return {
    fileId: result.$id,
    bucketId: bucketId,
    url: fileUrl,
    name: result.name,
    size: result.sizeOriginal,
    mimeType: result.mimeType,
  };
}

/**
 * Sube un string grande (como GeoJSON) como archivo a un bucket
 * @param {string} bucketId - ID del bucket
 * @param {string} content - Contenido a subir
 * @param {string} filename - Nombre del archivo
 * @param {string} mimeType - Tipo MIME del contenido
 * @param {string} teamId - ID del team para permisos (opcional)
 */
export async function uploadStringAsFile(bucketId, content, filename, mimeType = "application/json", teamId = null) {
  const blob = new Blob([content], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });

  return await uploadFile(bucketId, file, filename, teamId);
}

/**
 * Sube un GeoJSON a su bucket correspondiente
 * @param {string|Object} geojson - GeoJSON como string o objeto
 * @param {string} entityLabel - Label de la entidad (para el nombre del archivo)
 * @param {string} teamId - ID del team (opcional)
 */
export async function uploadGeoJSON(geojson, entityLabel = "polygon", teamId = null) {
  const content = typeof geojson === "string" ? geojson : JSON.stringify(geojson);
  const filename = `${entityLabel.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.geojson`;

  return await uploadStringAsFile(getBucketIdForDatatype("geojson"), content, filename, "application/geo+json", teamId);
}

/**
 * Sube un JSON grande a su bucket correspondiente
 * @param {string|Object} json - JSON como string o objeto
 * @param {string} name - Nombre base para el archivo
 * @param {string} teamId - ID del team (opcional)
 */
export async function uploadJSON(json, name = "data", teamId = null) {
  const content = typeof json === "string" ? json : JSON.stringify(json);
  const filename = `${name.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.json`;

  return await uploadStringAsFile(getBucketIdForDatatype("json"), content, filename, "application/json", teamId);
}

/**
 * Sube una imagen desde URL (descarga y re-sube)
 * @param {string} imageUrl - URL de la imagen
 * @param {string} teamId - ID del team (opcional)
 */
export async function uploadImageFromUrl(imageUrl, teamId = null) {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const extension = imageUrl.split(".").pop()?.split("?")[0] || "jpg";
    const filename = `image_${Date.now()}.${extension}`;

    const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
    return await uploadFile(getBucketIdForDatatype("image"), file, filename, teamId);
  } catch (error) {
    console.error("Error uploading image from URL:", error);
    throw error;
  }
}

/**
 * Sube una imagen desde un File local
 * @param {File} file - Archivo de imagen
 * @param {string} teamId - ID del team (opcional)
 */
export async function uploadImageFile(file, teamId = null) {
  const filename = file?.name || `image_${Date.now()}`;
  return await uploadFile(getBucketIdForDatatype("image"), file, filename, teamId);
}

/**
 * Sube un archivo a un bucket según datatype
 * @param {string} datatype - Tipo de dato
 * @param {File|Blob} file - Archivo a subir
 * @param {string} filename - Nombre del archivo (opcional)
 * @param {string} teamId - ID del team (opcional)
 */
export async function uploadFileByDatatype(datatype, file, filename = null, teamId = null) {
  const bucketId = getBucketIdForDatatype(datatype);
  return await uploadFile(bucketId, file, filename, teamId);
}

/**
 * Obtiene la URL de visualización de un archivo
 * @param {string} bucketId - ID del bucket
 * @param {string} fileId - ID del archivo
 */
export function getFileViewUrl(bucketId, fileId) {
  return storage.getFileView(bucketId, fileId);
}

/**
 * Obtiene la URL de descarga de un archivo
 * @param {string} bucketId - ID del bucket
 * @param {string} fileId - ID del archivo
 */
export function getFileDownloadUrl(bucketId, fileId) {
  return storage.getFileDownload(bucketId, fileId);
}

/**
 * Elimina un archivo de un bucket
 * @param {string} bucketId - ID del bucket
 * @param {string} fileId - ID del archivo
 */
export async function deleteFile(bucketId, fileId) {
  await storage.deleteFile(bucketId, fileId);
}

/**
 * Determina si un valor debería subirse a un bucket basándose en su tamaño
 * @param {string} value - Valor a evaluar
 * @param {number} threshold - Umbral en caracteres (default 10000)
 */
export function shouldUploadToBucket(value, threshold = 10000) {
  if (typeof value !== "string") {
    value = JSON.stringify(value);
  }
  return value.length > threshold;
}

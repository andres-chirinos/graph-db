# Audit Log Function

Función de Appwrite que registra cambios en `audit_log` cuando se crean, actualizan o eliminan registros en `entities`, `claims`, `qualifiers` y `references`.

## Variables de entorno requeridas

- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY`
- `APPWRITE_DATABASE_ID`

Opcionales:
- `APPWRITE_ENTITIES_TABLE_ID` (default: `entities`)
- `APPWRITE_CLAIMS_TABLE_ID` (default: `claims`)
- `APPWRITE_QUALIFIERS_TABLE_ID` (default: `qualifiers`)
- `APPWRITE_REFERENCES_TABLE_ID` (default: `references`)
- `APPWRITE_AUDIT_LOG_TABLE_ID` (default: `audit_log`)

## Eventos a configurar

Configura la función para escuchar eventos de base de datos para las tablas objetivo:

- `databases.{databaseId}.tables.{tableId}.rows.*.create`
- `databases.{databaseId}.tables.{tableId}.rows.*.update`
- `databases.{databaseId}.tables.{tableId}.rows.*.delete`

> Si tu proyecto usa Collections/Databases (legacy), usa los eventos equivalentes con `collections` y `documents`.

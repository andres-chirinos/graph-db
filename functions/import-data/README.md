# import-data

Función Appwrite para importar datos masivos a la base de datos GraphDB desde archivos CSV, JSON o XLSX.

## Características

- 📤 **Importación masiva** de entidades, claims, qualifiers y references
- 📊 **Múltiples formatos**: CSV, TSV, JSON, XLSX
- 🔗 **Mapeo flexible de campos** con transforms (string, number, boolean, array, json)
- 🚀 **Dos modos de inserción**: fila por fila o batch (lotes)
- 📋 **Reporte detallado** de errores por fila
- 🖥️ **Interfaz visual** (HTML) accesible vía GET con drag-and-drop
- 📖 **API programática** vía POST con JSON

---

## Instalación

```bash
cd functions/import-data
npm install
```

### Variables de entorno

Copia `.env.sample` a `.env` y configura:

| Variable | Descripción |
|:---|:---|
| `APPWRITE_ENDPOINT` | URL del servidor Appwrite |
| `APPWRITE_PROJECT_ID` | ID del proyecto |
| `APPWRITE_API_KEY` | API Key con permisos de escritura en databases |
| `APPWRITE_DATABASE_ID` | ID de la base de datos |

---

## Uso

### Interfaz Web (GET)

Accede a la URL de la función con un navegador para ver la interfaz visual. Permite:

1. Subir un archivo (CSV, JSON, XLSX)
2. Previsualizar los datos (primeras 10 filas)
3. Seleccionar la colección destino
4. Mapear columnas del archivo a campos de la colección
5. Ejecutar la importación con barra de progreso

### API Programática (POST)

#### Importar desde CSV string

```bash
curl -X POST "https://ENDPOINT/v1/functions/import-data/executions" \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: PROJECT_ID" \
  -H "X-Appwrite-Key: API_KEY" \
  -d '{
    "body": "{\"targetCollection\":\"entities\",\"csvData\":\"label,description,aliases\\nTierra,Tercer planeta,Tierra|Terra|Earth\\nLuna,Satélite natural,Luna|Moon\",\"fields\":[{\"source\":\"label\",\"target\":\"label\"},{\"source\":\"description\",\"target\":\"description\"},{\"source\":\"aliases\",\"target\":\"aliases\",\"transform\":\"array\"}]}"
  }'
```

#### Importar desde rows pre-procesados (JSON)

```bash
curl -X POST "https://ENDPOINT/v1/functions/import-data/executions" \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: PROJECT_ID" \
  -H "X-Appwrite-Key: API_KEY" \
  -d '{
    "body": "{\"targetCollection\":\"entities\",\"rows\":[{\"name\":\"Entidad 1\",\"desc\":\"Descripción 1\"},{\"name\":\"Entidad 2\",\"desc\":\"Descripción 2\"}],\"fields\":[{\"source\":\"name\",\"target\":\"label\"},{\"source\":\"desc\",\"target\":\"description\"}]}"
  }'
```

#### Importar Claims en batch

```bash
curl -X POST "https://ENDPOINT/v1/functions/import-data/executions" \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: PROJECT_ID" \
  -H "X-Appwrite-Key: API_KEY" \
  -d '{
    "body": "{\"targetCollection\":\"claims\",\"useBatch\":true,\"batchSize\":50,\"rows\":[{\"sub\":\"entity-id-1\",\"prop\":\"property-id\",\"val\":\"valor\"}],\"fields\":[{\"source\":\"sub\",\"target\":\"subject\"},{\"source\":\"prop\",\"target\":\"property\"},{\"source\":\"val\",\"target\":\"value_raw\"}]}"
  }'
```

---

## Esquema del Request Body

```json
{
  "targetCollection": "entities | claims | qualifiers | references",
  "format": "csv | json",
  "hasHeader": true,
  "delimiter": ",",
  "useBatch": false,
  "batchSize": 50,

  "csvData": "col1,col2\nval1,val2",
  "jsonData": [{"col1": "val1"}],
  "rows": [{"col1": "val1", "col2": "val2"}],

  "fields": [
    {
      "source": "columna_origen",
      "target": "campo_destino",
      "defaultValue": "",
      "transform": "string | number | boolean | json | array"
    }
  ]
}
```

> **Nota:** Solo se necesita UNA fuente de datos: `csvData`, `jsonData` o `rows`.

---

## Campos válidos por colección

| Colección | Campos |
|:---|:---|
| `entities` | `label`, `description`, `aliases` |
| `claims` | `subject`, `property`, `datatype`, `value_raw`, `value_relation` |
| `qualifiers` | `claim`, `property`, `datatype`, `value_raw`, `value_relation` |
| `references` | `claim`, `reference`, `details` |

---

## Transforms

| Transform | Descripción | Ejemplo |
|:---|:---|:---|
| `string` | Convierte a string (default) | `"123"` → `"123"` |
| `number` | Convierte a número | `"42"` → `42` |
| `boolean` | Convierte a boolean | `"true"` → `true` |
| `json` | Parsea como JSON | `'{"a":1}'` → `{a: 1}` |
| `array` | Split por `\|` o `;` | `"A\|B\|C"` → `["A","B","C"]` |

---

## Respuesta

```json
{
  "success": true,
  "total": 100,
  "created": 98,
  "errors": [
    { "row": 5, "error": "Invalid document structure", "data": {} }
  ],
  "hasMoreErrors": false
}
```

- `total`: Número de filas procesadas
- `created`: Número de documentos creados exitosamente
- `errors`: Array con errores (máximo 50 en la respuesta)
- `hasMoreErrors`: `true` si hay más de 50 errores

---

## Ejemplo de archivo CSV para entidades

```csv
label,description,aliases
Plantea Tierra,Tercer planeta del sistema solar,Tierra|Terra|Earth
Luna,Satélite natural de la Tierra,Luna|Moon
Sol,Estrella del sistema solar,Sol|Sun
```

Con el mapeo:
```json
{
  "fields": [
    { "source": "label", "target": "label" },
    { "source": "description", "target": "description" },
    { "source": "aliases", "target": "aliases", "transform": "array" }
  ]
}
```

# import-data

Función Appwrite para importar información masiva a la base de datos.

## Entradas
- `config`: JSON de configuración de importación.
- `file`: Archivo a importar (CSV, TSV, XLSX, JSON).

## Uso
Esta función debe ser llamada desde el frontend o backend usando el endpoint de funciones de Appwrite, enviando el archivo y la configuración como multipart/form-data.

## Notas
- Basada en la lógica de importación del API route local.
- Asegúrate de configurar las variables de entorno necesarias para Appwrite.

# Sistema de Plugins para Renderizado de Valores

Este sistema permite registrar plugins para renderizar diferentes tipos de datos (`value_raw`) en el explorador de entidades.

## Estructura de un value_raw

Los valores `value_raw` deben tener la siguiente estructura JSON:

```json
{
  "datatype": "string",
  "data": "valor del dato"
}
```

Donde:
- `datatype`: Identificador del tipo de dato (ej: "string", "date", "coordinate", "polygon")
- `data`: El valor real del dato

## Plugins Incluidos

| Plugin | Datatypes Soportados |
|--------|---------------------|
| StringPlugin | `string`, `text` |
| NumberPlugin | `number`, `integer`, `float`, `quantity` |
| DatePlugin | `date`, `datetime`, `time`, `year`, `month` |
| URLPlugin | `url`, `uri`, `link` |
| CoordinatePlugin | `coordinate`, `geo`, `location`, `point` |
| PolygonPlugin | `polygon`, `multipolygon`, `linestring`, `geometry` |
| ImagePlugin | `image`, `photo`, `picture`, `media` |
| BooleanPlugin | `boolean`, `bool` |
| JSONPlugin | `json`, `object`, `array` |
| ColorPlugin | `color`, `rgb`, `hex` |

## Cómo Crear un Plugin Personalizado

### 1. Estructura Básica

Crea un archivo en `src/plugins/datatypes/`:

```javascript
// src/plugins/datatypes/MiPlugin.js

const MiPlugin = {
  // Nombre único del plugin
  name: "mi-plugin",
  
  // Datatypes que este plugin puede renderizar
  datatypes: ["mi-datatype", "otro-datatype"],
  
  // Prioridad (mayor número = mayor prioridad)
  priority: 0,
  
  // Función de renderizado completo
  render(data, options = {}) {
    // data: el valor de .data del value_raw
    // options: opciones adicionales
    //   - datatype: el datatype original
    //   - fullValue: el objeto value_raw completo
    
    return {
      type: "mi-tipo-especial",
      // ... propiedades específicas
    };
  },
  
  // Función de preview (opcional, usa render si no existe)
  preview(data, options = {}) {
    return "Vista previa corta";
  }
};

export default MiPlugin;
```

### 2. Registrar el Plugin

En `src/plugins/index.js`:

```javascript
import MiPlugin from "./datatypes/MiPlugin";

registry.register(MiPlugin);
```

### 3. Renderizar Tipos Especiales

Si tu plugin retorna un objeto con `type`, actualiza `ValueRenderer.js`:

```javascript
// En src/components/ValueRenderer.js, función renderSpecialType

case "mi-tipo-especial":
  return (
    <div className="mi-tipo-especial">
      {/* Renderizado personalizado */}
    </div>
  );
```

## Ejemplo: Plugin de Moneda

```javascript
// src/plugins/datatypes/CurrencyPlugin.js

const CurrencyPlugin = {
  name: "currency",
  datatypes: ["currency", "money", "price"],
  priority: 1,
  
  render(data, options = {}) {
    const { fullValue } = options;
    const amount = Number(data);
    const currency = fullValue?.currency || "USD";
    
    const formatter = new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency
    });
    
    return {
      type: "currency",
      amount,
      currency,
      formatted: formatter.format(amount)
    };
  },
  
  preview(data, options = {}) {
    const result = this.render(data, options);
    return result.formatted;
  }
};

export default CurrencyPlugin;
```

## Ejemplos de Valores

### String
```json
{
  "datatype": "string",
  "data": "Hola mundo"
}
```

### Coordenada
```json
{
  "datatype": "coordinate",
  "data": {
    "latitude": 40.4168,
    "longitude": -3.7038
  }
}
```

### Polígono
```json
{
  "datatype": "polygon",
  "data": [
    [-3.7038, 40.4168],
    [-3.7040, 40.4170],
    [-3.7035, 40.4172],
    [-3.7038, 40.4168]
  ]
}
```

### URL con etiqueta
```json
{
  "datatype": "url",
  "data": "https://example.com",
  "label": "Sitio de ejemplo"
}
```

### Cantidad con unidad
```json
{
  "datatype": "quantity",
  "data": 1500,
  "unit": "km"
}
```

### Imagen
```json
{
  "datatype": "image",
  "data": "https://example.com/imagen.jpg",
  "alt": "Descripción de la imagen",
  "caption": "Pie de foto"
}
```

## API del Registry

```javascript
import registry from "@/plugins";

// Registrar un plugin
registry.register(miPlugin);

// Establecer plugin por defecto
registry.setDefault(pluginFallback);

// Renderizar un valor
const resultado = registry.render(value, opciones);

// Obtener preview
const preview = registry.preview(value, opciones);

// Listar datatypes registrados
const datatypes = registry.listDatatypes();

// Listar plugins
const plugins = registry.listPlugins();
```

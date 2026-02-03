/**
 * Plugin System Entry Point
 * 
 * Exporta el registry y registra todos los plugins por defecto.
 */

import registry from "./registry";

// Importar todos los plugins de datatypes
import StringPlugin from "./datatypes/StringPlugin";
import NumberPlugin from "./datatypes/NumberPlugin";
import DatePlugin from "./datatypes/DatePlugin";
import URLPlugin from "./datatypes/URLPlugin";
import CoordinatePlugin from "./datatypes/CoordinatePlugin";
import PolygonPlugin from "./datatypes/PolygonPlugin";
import ImagePlugin from "./datatypes/ImagePlugin";
import BooleanPlugin from "./datatypes/BooleanPlugin";
import JSONPlugin from "./datatypes/JSONPlugin";
import ColorPlugin from "./datatypes/ColorPlugin";

// Registrar todos los plugins
registry
  .register(StringPlugin)
  .register(NumberPlugin)
  .register(DatePlugin)
  .register(URLPlugin)
  .register(CoordinatePlugin)
  .register(PolygonPlugin)
  .register(ImagePlugin)
  .register(BooleanPlugin)
  .register(JSONPlugin)
  .register(ColorPlugin);

// Establecer plugin por defecto
registry.setDefault({
  name: "fallback",
  render: (data) => String(data ?? ""),
  preview: (data) => {
    const str = String(data ?? "");
    return str.length > 50 ? str.substring(0, 50) + "..." : str;
  },
});

export default registry;
export { registry };

// Re-exportar para uso externo
export { default as StringPlugin } from "./datatypes/StringPlugin";
export { default as NumberPlugin } from "./datatypes/NumberPlugin";
export { default as DatePlugin } from "./datatypes/DatePlugin";
export { default as URLPlugin } from "./datatypes/URLPlugin";
export { default as CoordinatePlugin } from "./datatypes/CoordinatePlugin";
export { default as PolygonPlugin } from "./datatypes/PolygonPlugin";
export { default as ImagePlugin } from "./datatypes/ImagePlugin";
export { default as BooleanPlugin } from "./datatypes/BooleanPlugin";
export { default as JSONPlugin } from "./datatypes/JSONPlugin";
export { default as ColorPlugin } from "./datatypes/ColorPlugin";

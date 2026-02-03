/**
 * Color Plugin
 * 
 * Renderiza valores de color (hex, rgb, etc).
 */

function renderColor(data, options = {}) {
  if (data === null || data === undefined) {
    return null;
  }

  let color = String(data);

  // Asegurar que tiene formato correcto
  if (!color.startsWith("#") && !color.startsWith("rgb")) {
    color = `#${color}`;
  }

  return {
    type: "color",
    value: color,
    display: color,
  };
}

const ColorPlugin = {
  name: "color",
  datatypes: ["color", "rgb", "hex"],
  priority: 0,

  render: renderColor,
  preview: renderColor,
};

export default ColorPlugin;

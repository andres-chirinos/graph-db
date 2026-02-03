/**
 * Color Plugin
 * 
 * Renderiza valores de color (hex, rgb, etc).
 */

const ColorPlugin = {
  name: "color",
  datatypes: ["color", "rgb", "hex"],
  priority: 0,

  render(data, options = {}) {
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
  },

  preview(data, options = {}) {
    return this.render(data, options);
  },
};

export default ColorPlugin;

/**
 * Number Plugin
 * 
 * Renderiza valores numéricos (integer, float, quantity).
 */

const NumberPlugin = {
  name: "number",
  datatypes: ["number", "integer", "float", "quantity"],
  priority: 0,

  render(data, options = {}) {
    if (data === null || data === undefined) {
      return null;
    }

    const { fullValue } = options;
    const value = Number(data);

    if (isNaN(value)) {
      return String(data);
    }

    // Si es una cantidad con unidad
    if (fullValue?.unit) {
      return `${value.toLocaleString()} ${fullValue.unit}`;
    }

    // Formatear número con separadores de miles
    return value.toLocaleString();
  },

  preview(data, options = {}) {
    return this.render(data, options);
  },
};

export default NumberPlugin;

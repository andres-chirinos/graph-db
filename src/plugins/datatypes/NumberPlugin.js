/**
 * Number Plugin
 * 
 * Renderiza valores numéricos (integer, float, quantity).
 */

function renderNumber(data, options = {}) {
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
}

const NumberPlugin = {
  name: "number",
  datatypes: ["number", "integer", "float", "quantity"],
  priority: 0,

  render: renderNumber,
  preview: renderNumber,
};

export default NumberPlugin;

/**
 * Boolean Plugin
 * 
 * Renderiza valores booleanos.
 */

function renderBoolean(data, options = {}) {
  if (data === null || data === undefined) {
    return null;
  }

  const value = data === true || data === "true" || data === 1 || data === "1";

  return {
    type: "boolean",
    value,
    display: value ? "Sí" : "No",
  };
}

const BooleanPlugin = {
  name: "boolean",
  datatypes: ["boolean", "bool"],
  priority: 0,

  render: renderBoolean,

  preview(data, options = {}) {
    const result = renderBoolean(data, options);
    if (result && typeof result === "object") {
      return result.display;
    }
    return result;
  },
};

export default BooleanPlugin;

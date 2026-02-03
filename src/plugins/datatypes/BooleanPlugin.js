/**
 * Boolean Plugin
 * 
 * Renderiza valores booleanos.
 */

const BooleanPlugin = {
  name: "boolean",
  datatypes: ["boolean", "bool"],
  priority: 0,

  render(data, options = {}) {
    if (data === null || data === undefined) {
      return null;
    }

    const value = data === true || data === "true" || data === 1 || data === "1";

    return {
      type: "boolean",
      value,
      display: value ? "Sí" : "No",
    };
  },

  preview(data, options = {}) {
    const result = this.render(data, options);
    if (result && typeof result === "object") {
      return result.display;
    }
    return result;
  },
};

export default BooleanPlugin;

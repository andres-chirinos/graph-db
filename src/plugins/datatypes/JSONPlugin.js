/**
 * JSON Plugin
 * 
 * Renderiza objetos JSON complejos.
 */

const JSONPlugin = {
  name: "json",
  datatypes: ["json", "object", "array"],
  priority: -1, // Baja prioridad, es un fallback

  render(data, options = {}) {
    if (data === null || data === undefined) {
      return null;
    }

    return {
      type: "json",
      data,
      formatted: JSON.stringify(data, null, 2),
    };
  },

  preview(data, options = {}) {
    if (data === null || data === undefined) {
      return null;
    }

    const str = JSON.stringify(data);
    const maxLength = options.maxLength || 50;
    return str.length > maxLength ? str.substring(0, maxLength) + "..." : str;
  },
};

export default JSONPlugin;

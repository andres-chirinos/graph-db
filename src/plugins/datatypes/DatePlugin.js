/**
 * Date Plugin
 * 
 * Renderiza valores de fecha y tiempo.
 */

function renderDate(data, options = {}) {
  if (data === null || data === undefined) {
    return null;
  }

  const { datatype } = options;

  try {
    switch (datatype) {
      case "year":
        return String(data);

      case "month": {
        const [year, month] = String(data).split("-");
        const date = new Date(year, month - 1);
        return date.toLocaleDateString(undefined, { year: "numeric", month: "long" });
      }

      case "date": {
        const date = new Date(data);
        return date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }

      case "time": {
        return data;
      }

      case "datetime":
      default: {
        const date = new Date(data);
        return date.toLocaleString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }
  } catch (e) {
    return String(data);
  }
}

const DatePlugin = {
  name: "date",
  datatypes: ["date", "datetime", "time", "year", "month"],
  priority: 0,

  render: renderDate,
  preview: renderDate,
};

export default DatePlugin;

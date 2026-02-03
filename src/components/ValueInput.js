"use client";

import { useState, useEffect } from "react";

const DATATYPES = [
  { value: "string", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Fecha" },
  { value: "url", label: "URL" },
  { value: "boolean", label: "Booleano" },
  { value: "coordinate", label: "Coordenadas" },
  { value: "color", label: "Color" },
  { value: "image", label: "Imagen (URL)" },
  { value: "json", label: "JSON" },
];

/**
 * Input para valores con tipo de dato (value_raw)
 * Permite seleccionar el tipo de dato y proporcionar el valor
 */
export default function ValueInput({
  value,
  onChange,
  label,
  required = false,
  disabled = false,
}) {
  const [datatype, setDatatype] = useState("string");
  const [data, setData] = useState("");

  // Parsear valor inicial
  useEffect(() => {
    if (value) {
      if (typeof value === "object" && value.datatype) {
        setDatatype(value.datatype);
        setData(formatDataForInput(value.data, value.datatype));
      } else if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (parsed.datatype) {
            setDatatype(parsed.datatype);
            setData(formatDataForInput(parsed.data, parsed.datatype));
          } else {
            setData(value);
          }
        } catch {
          setData(value);
        }
      }
    } else {
      setDatatype("string");
      setData("");
    }
  }, []);

  function formatDataForInput(data, type) {
    if (data === null || data === undefined) return "";
    
    switch (type) {
      case "date":
        // Si es timestamp, convertir a fecha
        if (typeof data === "number") {
          return new Date(data).toISOString().split("T")[0];
        }
        return data;
      case "coordinate":
        if (typeof data === "object" && data.lat !== undefined) {
          return `${data.lat}, ${data.lng}`;
        }
        return String(data);
      case "boolean":
        return data ? "true" : "false";
      case "json":
        return typeof data === "object" ? JSON.stringify(data, null, 2) : String(data);
      default:
        return String(data);
    }
  }

  function parseDataFromInput(inputValue, type) {
    if (!inputValue && inputValue !== 0 && inputValue !== false) return null;

    switch (type) {
      case "number":
        const num = parseFloat(inputValue);
        return isNaN(num) ? null : num;
      case "date":
        return inputValue; // Mantener como string ISO
      case "boolean":
        return inputValue === "true" || inputValue === true;
      case "coordinate":
        const parts = String(inputValue).split(",").map((s) => s.trim());
        if (parts.length === 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng };
          }
        }
        return inputValue;
      case "json":
        try {
          return JSON.parse(inputValue);
        } catch {
          return inputValue;
        }
      default:
        return inputValue;
    }
  }

  function handleChange(newDatatype, newData) {
    setDatatype(newDatatype);
    setData(newData);

    const parsedData = parseDataFromInput(newData, newDatatype);
    onChange({
      datatype: newDatatype,
      data: parsedData,
    });
  }

  function renderInput() {
    const commonProps = {
      className: "form-input",
      value: data,
      onChange: (e) => handleChange(datatype, e.target.value),
      disabled,
      required,
    };

    switch (datatype) {
      case "number":
        return (
          <input
            type="number"
            step="any"
            placeholder="Ingrese un número"
            {...commonProps}
          />
        );

      case "date":
        return (
          <input
            type="date"
            {...commonProps}
          />
        );

      case "url":
      case "image":
        return (
          <input
            type="url"
            placeholder="https://ejemplo.com"
            {...commonProps}
          />
        );

      case "boolean":
        return (
          <select
            className="form-select"
            value={data}
            onChange={(e) => handleChange(datatype, e.target.value)}
            disabled={disabled}
          >
            <option value="">Seleccionar...</option>
            <option value="true">Verdadero</option>
            <option value="false">Falso</option>
          </select>
        );

      case "color":
        return (
          <div className="color-input-wrapper">
            <input
              type="color"
              value={data || "#000000"}
              onChange={(e) => handleChange(datatype, e.target.value)}
              disabled={disabled}
            />
            <input
              type="text"
              placeholder="#000000"
              {...commonProps}
            />
          </div>
        );

      case "coordinate":
        return (
          <input
            type="text"
            placeholder="Latitud, Longitud (ej: 40.7128, -74.0060)"
            {...commonProps}
          />
        );

      case "json":
        return (
          <textarea
            className="form-textarea form-textarea-code"
            placeholder='{"key": "value"}'
            rows={4}
            {...commonProps}
          />
        );

      default:
        return (
          <input
            type="text"
            placeholder="Ingrese un valor"
            {...commonProps}
          />
        );
    }
  }

  return (
    <div className="value-input">
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}

      <div className="value-input-row">
        <select
          className="form-select value-type-select"
          value={datatype}
          onChange={(e) => handleChange(e.target.value, data)}
          disabled={disabled}
        >
          {DATATYPES.map((dt) => (
            <option key={dt.value} value={dt.value}>
              {dt.label}
            </option>
          ))}
        </select>

        <div className="value-data-input">{renderInput()}</div>
      </div>
    </div>
  );
}

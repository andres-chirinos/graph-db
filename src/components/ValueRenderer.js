"use client";

import registry from "@/plugins";

/**
 * Renderiza un valor usando el sistema de plugins
 */
export default function ValueRenderer({ value, compact = false }) {
  if (!value) return null;

  const rendered = compact 
    ? registry.preview(value) 
    : registry.render(value);

  // Si el plugin retorna un objeto especial, renderizar según el tipo
  if (rendered && typeof rendered === "object") {
    return renderSpecialType(rendered, compact);
  }

  // Retornar como texto simple
  return <span className="value-text">{rendered}</span>;
}

/**
 * Renderiza tipos especiales devueltos por los plugins
 */
function renderSpecialType(data, compact) {
  switch (data.type) {
    case "link":
      return (
        <a
          href={data.href}
          target={data.external ? "_blank" : undefined}
          rel={data.external ? "noopener noreferrer" : undefined}
          className="value-link"
        >
          {data.label}
          {data.external && <span className="icon-external-link external-icon"></span>}
        </a>
      );

    case "coordinate":
      return (
        <span className="value-coordinate">
          <span className="coordinate-display">{data.display}</span>
          <a
            href={data.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="coordinate-map-link"
            title="Ver en mapa"
          >
            <span className="icon-map"></span>
          </a>
        </span>
      );

    case "geometry":
      return (
        <span className="value-geometry">
          <span className="icon-map-pin"></span>
          <span>{data.geometryType} ({data.pointCount} puntos)</span>
        </span>
      );

    case "image":
      return compact ? (
        <span className="value-image-thumb">
          <img src={data.thumbnail || data.url} alt={data.alt} />
        </span>
      ) : (
        <figure className="value-image">
          <img src={data.url} alt={data.alt} />
          {data.caption && <figcaption>{data.caption}</figcaption>}
        </figure>
      );

    case "image-thumbnail":
      return (
        <span className="value-image-thumb">
          <img src={data.url} alt="Thumbnail" />
        </span>
      );

    case "boolean":
      return (
        <span className={`value-boolean ${data.value ? "is-true" : "is-false"}`}>
          <span className={data.value ? "icon-check" : "icon-x"}></span>
          {data.display}
        </span>
      );

    case "color":
      return (
        <span className="value-color">
          <span
            className="color-swatch"
            style={{ backgroundColor: data.value }}
          ></span>
          <span className="color-code">{data.display}</span>
        </span>
      );

    case "json":
      return compact ? (
        <span className="value-json-preview">
          {JSON.stringify(data.data).substring(0, 50)}...
        </span>
      ) : (
        <pre className="value-json">
          <code>{data.formatted}</code>
        </pre>
      );

    default:
      return <span className="value-unknown">{JSON.stringify(data)}</span>;
  }
}

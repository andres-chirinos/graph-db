import React from "react";
import { parseSearchQuery, normalizeText } from "@/lib/database";

/**
 * Resalta las palabras buscadas dentro de un texto.
 * Soporta múltiples palabras clave separadas por espacio, ignorando acentos y mayúsculas.
 * 
 * @param {Object} props
 * @param {string} props.text - Texto original a mostrar
 * @param {string} props.query - La búsqueda del usuario
 * @param {string} props.className - Clase CSS adicional
 */
export default function HighlightText({ text, query, className = "" }) {
    if (!text) return null;
    if (!query || query.trim() === "") return <span className={className}>{text}</span>;

    // Normalizar la consulta para extraer palabras clave exactas y opcionales
    const parsed = parseSearchQuery(query);
    const keywords = [...parsed.exactPhrases, ...parsed.optionalTerms]
        .map(k => normalizeText(k))
        .filter(Boolean);

    if (keywords.length === 0) return <span className={className}>{text}</span>;

    // Escapar caracteres especiales para regex
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Crear una expresión regular que busque cualquier palabra clave (ignorando TODO tipo de acento si pudiéramos, 
    // pero ya que text original tiene acentos, necesitamos un truco o buscar sin case)
    // Como JS Regex no soporta ignore-accents nativo fácilmente, haremos un map simplificado

    // En lugar de una regex perfecta, dividiremos el texto original e inspeccionaremos cada palabra normalizada
    const tokens = text.split(/(\s+|[,.;:!?()[\]{}"]+)/); // Dividir por espacios y puntuación manteniendo los separadores

    return (
        <span className={className}>
            {tokens.map((token, index) => {
                const normToken = normalizeText(token);
                const isHighlight = keywords.some(k => normToken.includes(k) || k.includes(normToken) && normToken.length > 2);

                if (isHighlight && token.trim() !== "") {
                    return (
                        <mark key={index} className="highlighted-text" style={{ backgroundColor: 'rgba(255, 213, 79, 0.4)', color: 'inherit', fontWeight: 'bold', padding: '0 2px', borderRadius: '2px' }}>
                            {token}
                        </mark>
                    );
                }
                return <React.Fragment key={index}>{token}</React.Fragment>;
            })}
        </span>
    );
}

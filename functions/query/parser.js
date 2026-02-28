/*
 * Simple SPARQL-like parser
 * Designed to be extensible in the future for a full SPARQL implementation.
 */

class SparqlParser {
    constructor(query) {
        this.rawQuery = query;
        this.parsed = {
            type: null, // e.g. 'SELECT'
            variables: [], // e.g. ['?item', '?label']
            wherePattern: [], // Array of triple objects: { subject, predicate, object }
            limit: null, // e.g. 100
            offset: null // e.g. 20
        };
    }

    parse() {
        this.parsed.type = this._extractQueryType();

        if (this.parsed.type === 'SELECT') {
            this.parsed.variables = this._extractSelectVariables();
        }

        this.parsed.wherePattern = this._extractWhereClauses();

        // Extract limit
        const limitMatch = this.rawQuery.match(/LIMIT\s+(\d+)/i);
        if (limitMatch) {
            this.parsed.limit = parseInt(limitMatch[1], 10);
        }

        // Extract offset
        const offsetMatch = this.rawQuery.match(/OFFSET\s+(\d+)/i);
        if (offsetMatch) {
            this.parsed.offset = parseInt(offsetMatch[1], 10);
        }

        return this.parsed;
    }

    _extractQueryType() {
        const match = this.rawQuery.match(/^\s*(SELECT|CONSTRUCT|ASK|DESCRIBE)[\s]/i);
        return match ? match[1].toUpperCase() : 'UNKNOWN';
    }

    _extractSelectVariables() {
        // Matches everything between SELECT and WHERE
        const selectMatch = this.rawQuery.match(/SELECT\s+(.+?)\s+WHERE\s*\{/is);
        if (!selectMatch) return [];

        const varString = selectMatch[1].trim();
        if (varString === '*') return ['*'];

        return varString.split(/\s+/).filter(v => v.startsWith('?'));
    }

    _extractWhereClauses() {
        // Extract the content inside WHERE { ... }
        const whereMatch = this.rawQuery.match(/WHERE\s*\{(.+?)\}/is);
        if (!whereMatch) return [];

        const blockContent = whereMatch[1].trim();

        // Split by . accounting for potential blank lines
        const statements = blockContent.split('.').map(s => s.trim()).filter(s => s.length > 0);

        const triples = [];

        for (const stmt of statements) {
            // Basic triple matching: Subject Predicate Object
            // This regex handles standard uris like prop:P31 or variables like ?item or quoted strings
            // Highly simplified for MVP
            const tokens = stmt.split(/\s+/);

            if (tokens.length >= 3) {
                // Handle basic "S P O" triples. 
                // Note: this rudimentary parser doesn't handle complex literals with spaces well without quotes
                const subject = tokens[0];
                const predicate = tokens[1];

                // Everything else is the object (in case it's a string literal like "Hello World")
                const object = tokens.slice(2).join(' ').replace(/^['"](.*)['"]$/, '$1');

                triples.push({
                    subject,
                    predicate,
                    object
                });
            }
        }

        return triples;
    }
}

module.exports = { SparqlParser };

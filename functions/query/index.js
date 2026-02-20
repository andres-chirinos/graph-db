const fs = require('fs');
const path = require('path');
const sdk = require('node-appwrite');
const { SparqlParser } = require('./parser');

// Defaults or environment variables
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "master";
const TABLES = {
    ENTITIES: process.env.APPWRITE_ENTITIES_TABLE_ID || "entities",
    CLAIMS: process.env.APPWRITE_CLAIMS_TABLE_ID || "claims",
    QUALIFIERS: process.env.APPWRITE_QUALIFIERS_TABLE_ID || "qualifiers",
    REFERENCES: process.env.APPWRITE_REFERENCES_TABLE_ID || "references",
};

/**
 * Simplified execute engine for the basic SPARQL parser
 * Supports direct props: `?item prop:P31 item:Q5`
 * Supports statements/qualifiers/references:
 *  `?item claim:P31 ?statement`
 *  `?statement value: item:Q5`
 *  `?statement qual:P580 ?startDate`
 *  `?statement ref:P854 ?source`
 */
async function executeSparql(parsed, databases) {
    if (parsed.type !== 'SELECT') {
        throw new Error('Only SELECT queries are supported in this engine version.');
    }
    if (parsed.wherePattern.length === 0) {
        throw new Error('WHERE clause cannot be empty.');
    }

    const anchorPattern = parsed.wherePattern.find(p => p.predicate.startsWith('prop:') || p.predicate.startsWith('claim:'));
    if (!anchorPattern) {
        throw new Error('A `prop:Pxx` or `claim:Pxx` predicate is required to anchor the query to entities.');
    }

    let propertyId;
    let targetValue = null;
    let statementVar = null;

    if (anchorPattern.predicate.startsWith('prop:')) {
        propertyId = anchorPattern.predicate.replace('prop:', '');
        targetValue = anchorPattern.object.replace('item:', '');
    } else if (anchorPattern.predicate.startsWith('claim:')) {
        propertyId = anchorPattern.predicate.replace('claim:', '');
        statementVar = anchorPattern.object;
        const valuePattern = parsed.wherePattern.find(p => p.subject === statementVar && p.predicate === 'value:');
        if (valuePattern && !valuePattern.object.startsWith('?')) {
            targetValue = valuePattern.object.replace('item:', '');
        }
    }

    const queries = [
        sdk.Query.equal('property', propertyId),
        sdk.Query.limit(100)
    ];
    if (targetValue) queries.push(sdk.Query.equal('value', targetValue));

    const claimsResponse = await databases.listDocuments(DATABASE_ID, TABLES.CLAIMS, queries);
    let results = [];
    const subjectVar = anchorPattern.subject;

    for (const document of claimsResponse.documents) {
        let isValid = true;
        let resultRow = {};
        const data = typeof document.data === 'string' ? JSON.parse(document.data) : (document.data || document);
        const subjectId = data.subject || data.$id;
        const claimId = document.$id;

        // Populate basic variables dynamically
        if (statementVar && parsed.variables.includes(statementVar)) resultRow[statementVar] = claimId;

        const valueVarPattern = parsed.wherePattern.find(p => p.subject === statementVar && p.predicate === 'value:' && p.object.startsWith('?'));
        if (valueVarPattern && parsed.variables.includes(valueVarPattern.object)) {
            resultRow[valueVarPattern.object] = data.value;
        }

        // Process other patterns like qualifiers and references strictly (INNER JOIN behavior)
        for (const pattern of parsed.wherePattern) {
            if (pattern === anchorPattern) continue;
            if (pattern.subject === statementVar && pattern.predicate === 'value:') continue;

            if (pattern.subject === statementVar && pattern.predicate.startsWith('qual:')) {
                const qualPropId = pattern.predicate.replace('qual:', '');
                const qualVar = pattern.object;
                try {
                    const qualResponse = await databases.listDocuments(DATABASE_ID, TABLES.QUALIFIERS, [
                        sdk.Query.equal('claim', claimId),
                        sdk.Query.equal('property', qualPropId),
                        sdk.Query.limit(1)
                    ]);
                    if (qualResponse.documents.length > 0) {
                        const qdata = typeof qualResponse.documents[0].data === 'string' ? JSON.parse(qualResponse.documents[0].data) : (qualResponse.documents[0].data || qualResponse.documents[0]);
                        if (parsed.variables.includes(qualVar) || parsed.variables.includes('*')) resultRow[qualVar] = qdata.value;
                    } else {
                        isValid = false; break;
                    }
                } catch { isValid = false; break; }
            }
            else if (pattern.subject === statementVar && pattern.predicate.startsWith('ref:')) {
                const refPropId = pattern.predicate.replace('ref:', '');
                const refVar = pattern.object;
                try {
                    const refResponse = await databases.listDocuments(DATABASE_ID, TABLES.REFERENCES, [
                        sdk.Query.equal('claim', claimId),
                        sdk.Query.equal('property', refPropId),
                        sdk.Query.limit(1)
                    ]);
                    if (refResponse.documents.length > 0) {
                        const rdata = typeof refResponse.documents[0].data === 'string' ? JSON.parse(refResponse.documents[0].data) : (refResponse.documents[0].data || refResponse.documents[0]);
                        if (parsed.variables.includes(refVar) || parsed.variables.includes('*')) resultRow[refVar] = rdata.value;
                    } else {
                        isValid = false; break;
                    }
                } catch { isValid = false; break; }
            }
        }

        if (!isValid) continue;

        // Fetch entity label if needed
        if (parsed.variables.includes('?label') || parsed.variables.includes('*')) {
            try {
                const entityRow = await databases.getDocument(DATABASE_ID, TABLES.ENTITIES, subjectId);
                const entityData = typeof entityRow.data === 'string' ? JSON.parse(entityRow.data) : (entityRow.data || entityRow);
                resultRow['?label'] = entityData.label || entityData.name || null;
            } catch {
                resultRow['?label'] = null;
            }
        }

        // Complete the row
        for (const v of parsed.variables) {
            if (v === subjectVar) resultRow[subjectVar] = subjectId;
            if (resultRow[v] === undefined && v !== '*') resultRow[v] = null;
        }

        results.push(resultRow);
    }
    return results;
}

module.exports = async ({ req, res, log, error }) => {
    try {
        // Serve HTML Interface
        if (req.method === 'GET') {
            const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

            const endpoint = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
            const projectId = process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

            const configHtml = htmlContent
                .replace('{{APPWRITE_ENDPOINT}}', endpoint)
                .replace('{{APPWRITE_PROJECT_ID}}', projectId);

            return res.text(configHtml, 200, {
                'Content-Type': 'text/html',
            });
        }

        // Handle Query Execution
        if (req.method === 'POST') {
            let body = req.body;
            if (typeof body === 'string') {
                body = JSON.parse(body);
            }

            if (!body.query) {
                return res.json({ error: 'Query is missing' }, 400);
            }

            const parser = new SparqlParser(body.query);
            const parsed = parser.parse();

            log("Parsed Query: " + JSON.stringify(parsed));

            const endpoint = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
            const projectId = process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
            const apiKey = req.headers['x-appwrite-key'] || process.env.APPWRITE_API_KEY;

            const client = new sdk.Client()
                .setEndpoint(endpoint)
                .setProject(projectId);

            if (apiKey) {
                client.setKey(apiKey);
            } else {
                log("Warning: No API Key provided. Queries might fail due to permissions.");
            }

            const databases = new sdk.Databases(client);

            const results = await executeSparql(parsed, databases);

            return res.json({
                results: {
                    bindings: results
                }
            }, 200);
        }

        return res.json({ error: 'Method not allowed' }, 405);
    } catch (err) {
        error(err.message);
        return res.json({ error: err.message || 'Server Error' }, 500);
    }
};

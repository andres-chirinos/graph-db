const handler = require('./index');

async function testIndex() {
    const req = {
        method: 'POST',
        headers: {
            'x-appwrite-key': ''
        },
        body: {
            query: `SELECT ?item ?label ?qualValue ?refValue
WHERE {
  ?item claim:P31 ?statement .
  ?statement value: item:Q5 .
  ?statement qual:P580 ?qualValue .
  ?statement ref:P854 ?refValue .
}`
        }
    };

    const res = {
        json: (data, code) => {
            console.log(`RESPONSE [${code}]:`, JSON.stringify(data, null, 2));
            return data;
        }
    };

    const log = (msg) => console.log(`LOG: ${msg}`);
    const error = (msg) => console.error(`ERROR: ${msg}`);

    process.env.APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
    process.env.APPWRITE_PROJECT_ID = 'testproject123';
    process.env.APPWRITE_DATABASE_ID = 'master';
    process.env.APPWRITE_ENTITIES_TABLE_ID = 'entities';
    process.env.APPWRITE_CLAIMS_TABLE_ID = 'claims';
    process.env.APPWRITE_QUALIFIERS_TABLE_ID = 'qualifiers';
    process.env.APPWRITE_REFERENCES_TABLE_ID = 'references';

    await handler({ req, res, log, error });
}

testIndex();

const { SparqlParser } = require('./parser');

const query1 = `
SELECT ?item ?label
WHERE {
  ?item prop:P31 item:Q5 .
  ?item prop:P17 item:Q28
}
`;

const parser = new SparqlParser(query1);
const parsed1 = parser._extractWhereClauses();
const vars1 = parser._extractSelectVariables();
console.log("Parsed Variables:", vars1);
console.log("Parsed Where:", parsed1);

const full = parser.parse();
console.log("Full parsed object:", JSON.stringify(full, null, 2));

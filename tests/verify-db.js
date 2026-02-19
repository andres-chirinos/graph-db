require('dotenv').config({ path: '.env.local' });
const db = require('./src/lib/database');

async function verify() {
    console.log("Verifying database exports...");
    const expectedExports = [
        'listEntities',
        'getClaimsBySubject',
        'createRowsBulk',
        'runWithTransaction'
    ];

    for (const exp of expectedExports) {
        if (typeof db[exp] !== 'function') {
            console.error(`Missing export: ${exp}`);
            process.exit(1);
        }
    }
    console.log("Exports verified.");

    // We can't easily run a real DB query without proper env vars and setup in this script context 
    // if it requires browser-specifics or complex auth.
    // But we can check if the module loaded without error.
    console.log("Database module loaded successfully.");
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});

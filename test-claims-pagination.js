
import { getClaimsBySubject } from "./src/lib/db-claims.js";
import { getEntity, createEntity } from "./src/lib/db-entities.js";
import { createClaim } from "./src/lib/db-claims.js";

async function testClaimsPagination() {
    console.log("Starting Claims Pagination Test...");

    // 1. Create a dummy entity
    console.log("Creating dummy entity...");
    const entity = await createEntity({
        label: "Pagination Test Entity",
        description: "Testing claims pagination",
    });
    const entityId = entity.data.$id;
    console.log(`Created entity: ${entityId}`);

    try {
        // 2. Create 15 dummy claims
        console.log("Creating 15 dummy claims...");
        const propertyId = "prop_test"; // Assuming this exists or just using a string
        for (let i = 0; i < 15; i++) {
            await createClaim({
                subject: entityId,
                property: propertyId,
                value_raw: `Claim Value ${i}`,
                datatype: "string"
            });
        }
        console.log("Claims created.");

        // 3. Test Page 1 (Limit 10)
        console.log("Testing Page 1 (Limit 10)...");
        const page1 = await getClaimsBySubject(entityId, { limit: 10, offset: 0 });
        console.log(`Page 1 Results: ${page1.claims.length} claims (Expected 10). Total: ${page1.total}`);
        if (page1.claims.length !== 10) throw new Error("Page 1 count mismatch");

        // 4. Test Page 2 (Limit 10, Offset 10)
        console.log("Testing Page 2 (Limit 10, Offset 10)...");
        const page2 = await getClaimsBySubject(entityId, { limit: 10, offset: 10 });
        console.log(`Page 2 Results: ${page2.claims.length} claims (Expected 5). Total: ${page2.total}`);
        if (page2.claims.length !== 5) throw new Error("Page 2 count mismatch");

        // 5. Test Filter by Value
        console.log("Testing Filter by Value 'Claim Value 5'...");
        const filtered = await getClaimsBySubject(entityId, {
            limit: 10,
            offset: 0,
            filters: { value: "Claim Value 5" }
        });
        console.log(`Filtered Results: ${filtered.claims.length} claims. Total: ${filtered.total}`);
        const found = filtered.claims.some(c => c.value_raw.includes("Claim Value 5"));
        if (!found) throw new Error("Filter did not find the expected claim");

        console.log("SUCCESS: All backend tests passed.");

    } catch (error) {
        console.error("FAILURE:", error);
    } finally {
        // Cleanup ideally, but for now we might leave it or delete manually
        console.log("Test complete.");
    }
}

// testClaimsPagination();

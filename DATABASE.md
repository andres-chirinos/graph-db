# Appwrite Database Structure

## Configuration
- **Database ID**: From `process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID`

## Collections

### 1. Entities (`entities`)
Core nodes in the graph database.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `label` | String | No | Primary label or name of the entity. |
| `description` | String | No | Textual description of the entity. |
| `aliases` | String[] | No | Alternative names or synonyms for the entity. |
| `claims_subject` | Relationship[] | No | Claims where this entity is the subject. |
| `claims_property` | Relationship[] | No | Claims where this entity is the property. |
| `claims_related` | Relationship[] | No | Claims where this entity is related to. |
| `qualifiers_property` | Relationship[] | No | Qualifiers where this entity is the property. |
| `qualifiers_related` | Relationship[] | No | Qualifiers where this entity is related to. |
| `references_related` | Relationship[] | No | References where this entity is related to. |

### 2. Claims (`claims`)
Facts or statements about entities (Triples: Subject -> Property -> Value).

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `subject` | Relationship | Yes | The entity this claim is about (Subject). |
| `property` | Relationship | Yes | The entity acting as the property/predicate. |
| `datatype` | String | Yes | Type of the value (e.g., "string", "relation", "date", "number"). |
| `value_raw` | String | No | The literal value or JSON string (if `datatype` is not "relation"). |
| `value_relation` | Relationship | No | The related entity value (if `datatype` is "relation"). |
| `qualifiers` | Relationship[] | No | Qualifiers for this claim. |
| `references` | Relationship[] | No | References for this claim. |

### 3. Qualifiers (`qualifiers`)
Additional information/context for a Claim (e.g., date, source confidence).

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `claim` | Relationship | Yes | The Claim this qualifier belongs to. |
| `property` | Relationship | Yes | The entity acting as the property for this qualifier. |
| `datatype` | String | Yes | Type of the value (e.g., "string", "relation"). |
| `value_raw` | String | No | The literal value or JSON string. |
| `value_relation` | Relationship | No | The related entity value. |

### 4. References (`references`)
Citations or sources linked to a Claim.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `claim` | Relationship | Yes | The Claim being referenced. |
| `reference` | Relationship | Yes | The entity acting as the source/reference. |
| `details` | String | No | Additional details about the reference (e.g., page number), often JSON. |

### 5. Audit Log (`graphdb_audit` or configured ID)
Tracks changes and transactions within the system.

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `action` | String | Yes | Action type (e.g., "create", "update", "delete"). |
| `tableId` | String | Yes | The table/collection affected. |
| `rowId` | String | Yes | The ID of the affected document. |
| `before` | String (JSON) | No | State of the document before the change (system fields stripped). |
| `after` | String (JSON) | No | State of the document after the change (system fields stripped). |
| `status` | String | Yes | Transaction status (e.g., "pending", "committed"). |
| `transactionId` | String | No | Grouping ID for atomic transactions. |
| `changes` | String[] | No | Array of change descriptions or details. |
| `userId` | String | No | ID of the user who performed the action. |
| `userEmail` | String | No | Email of the user who performed the action. |
| `note` | String | No | Optional note or comment about the change. |
| `relatedAuditId` | String | No | ID linking to another audit entry. |

## System Fields (All Collections)
- `$id`: Unique identifier
- `$createdAt`: Timestamp of creation
- `$updatedAt`: Timestamp of last update
- `$permissions`: Access control list

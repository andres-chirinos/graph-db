# Developer Guide

## Project Structure

This project is a Next.js application using Appwrite as the backend.

```
/src
  /app           # Next.js App Router pages
  /components    # React components
  /lib           # Core logic and utilities
  /styles        # Global styles
/tests           # Verification scripts
/docs            # Documentation
```

## Core Libraries (`src/lib`)

The database logic has been refactored into modular files for better maintainability.

- **`database.js`**: Central export point (Barrel file).
- **`db-core.js`**: Constants (`TABLES`, `DATABASE_ID`) and helpers (`generatePermissions`, `normalizeText`).
- **`db-entities.js`**: Entity CRUD and search logic.
- **`db-claims.js`**: Claims management.
- **`db-qualifiers.js`**: Qualifiers management.
- **`db-references.js`**: References management.
- **`db-bulk.js`**: Atomic bulk operations using Appwrite's `createOperations`.
- **`db-audit.js`**: Transaction management and audit logging.

### Database Modules
All database interactions should go through these modules rather than using the Appwrite SDK directly in components. This ensures consistent permission handling and audit logging.

## Components (`src/components`)

### Relationships View
The `RelationshipsView` component is the primary way to display complex entity relationships.

- **`RelationshipsView.js`**: Container component that fetches and displays relationships (claims, qualifiers, references).
- **`RelationshipItem.js`**: Renders a single relationship row.
- **`QualifierItem.js` / `ReferenceItem.js`**: Specialized sub-components for detailed views.

### Usage
```jsx
<RelationshipsView 
  entityId={id} 
  type="reverse" // or "property", "claims", "references"
  label="Referenced By" 
/>
```

## Styling
- **Tailwind CSS**: Used for layout and utility classes.
- **CSS Modules**: Used for component-specific styling (`RelationshipsView.css`, etc.) where standard Tailwind classes are insufficient for complex layouts.

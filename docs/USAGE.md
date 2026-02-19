# Application Usage Guide

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Ensure `.env.local` is configured with:
   - `NEXT_PUBLIC_APPWRITE_ENDPOINT`
   - `NEXT_PUBLIC_APPWRITE_PROJECT_ID`
   - `NEXT_PUBLIC_APPWRITE_DATABASE_ID`
   - `NEXT_PUBLIC_AUDIT_TABLE_ID` (Optional)

3. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) inside your browser.

## Features

### Entity Explorer
- **Search**: Use the search bar to find entities by name, alias, or description.
- **Navigation**: Click on any entity link to view its detailed page.

### Entity Details
The entity page displays:
- **Core Info**: Label, description, aliases.
- **Relationships**:
  - **Properties**: Facts/Claims about the entity.
  - **Incoming References**: Other entities that link to this one.
  - **Qualifiers**: Contextual details about specific claims.
  - **References**: Citations or sources backing up claims.

### Editing Data
- **Inline Editing**: (If permissions allow) click on fields to edit them.
- **Add Relations**: Use the "+ Add" buttons in respective sections to create new relationships.

### Bulk Operations
The system supports bulk import/export of data. See `db-import.js` and `db-bulk.js` for programmatic access.

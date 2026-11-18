# Cloud DB Migrations

This repo started with schema-first Drizzle tables and no checked-in migration
history. New database changes should include a visible SQL artifact here so
deployment can apply the same columns/indexes that the TypeScript schema expects.

For a fresh private environment, run the SQL files in filename order. The
`0000_initial_schema.sql` baseline creates the tables, indexes, and sequences
that later incremental migrations expect.

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const isPG = knex.client.config.client === 'pg';
  if (!isPG) return;

  await knex.schema.raw(
    'ALTER TABLE bmad_documents ADD COLUMN IF NOT EXISTS content_tsv tsvector',
  );
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_docs_search ON bmad_documents USING GIN (content_tsv)',
  );
  await knex.schema.raw(`
    CREATE OR REPLACE FUNCTION bmad_docs_tsv_update() RETURNS trigger AS $$
    BEGIN
      NEW.content_tsv :=
        setweight(to_tsvector('spanish', coalesce(NEW.path, '')), 'A') ||
        setweight(to_tsvector('spanish', coalesce(NEW.content, '')), 'B');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);
  await knex.schema.raw(`
    DROP TRIGGER IF EXISTS bmad_docs_tsv_trigger ON bmad_documents;
    CREATE TRIGGER bmad_docs_tsv_trigger
      BEFORE INSERT OR UPDATE ON bmad_documents
      FOR EACH ROW EXECUTE FUNCTION bmad_docs_tsv_update()
  `);
}

export async function down(knex: Knex): Promise<void> {
  const isPG = knex.client.config.client === 'pg';
  if (!isPG) return;

  await knex.schema.raw(
    'DROP TRIGGER IF EXISTS bmad_docs_tsv_trigger ON bmad_documents',
  );
  await knex.schema.raw('DROP FUNCTION IF EXISTS bmad_docs_tsv_update()');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_docs_search');
}

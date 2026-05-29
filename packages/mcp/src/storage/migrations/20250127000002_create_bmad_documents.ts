import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const isPG = knex.client.config.client === 'pg';
  await knex.schema.createTable('bmad_documents', (t) => {
    t.increments('id');
    t.text('project_name')
      .notNullable()
      .references('name')
      .inTable('bmad_projects')
      .onDelete('CASCADE');
    t.text('path').notNullable();
    t.text('content').notNullable();
    t.text('content_type').defaultTo('markdown');
    t.text('workflow');
    t.text('agent');
    t.integer('version').defaultTo(1);
    if (isPG) {
      t.specificType('content_tsv', 'tsvector');
      t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    } else {
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    }
    t.primary(['project_name', 'id']);
  });

  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_docs_project_path ON bmad_documents(project_name, path)',
  );
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_docs_workflow ON bmad_documents(project_name, workflow)',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bmad_documents');
}

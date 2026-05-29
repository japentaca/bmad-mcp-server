import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const isPG = knex.client.config.client === 'pg';
  await knex.schema.createTable('bmad_workflow_status', (t) => {
    t.increments('id');
    t.text('project_name')
      .notNullable()
      .references('name')
      .inTable('bmad_projects')
      .onDelete('CASCADE');
    t.text('workflow').notNullable();
    if (isPG) {
      t.jsonb('status').notNullable().defaultTo('{}');
      t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    } else {
      t.text('status').notNullable().defaultTo('{}');
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    }
    t.primary(['project_name', 'id']);
    t.unique(['project_name', 'workflow']);
  });

  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_status_project ON bmad_workflow_status(project_name, workflow)',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bmad_workflow_status');
}

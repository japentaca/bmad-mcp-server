import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const isPG = knex.client.config.client === 'pg';
  await knex.schema.createTable('bmad_projects', (t) => {
    t.text('name').primary();
    if (isPG) {
      t.jsonb('config').defaultTo('{}');
      t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    } else {
      t.text('config').defaultTo('{}');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bmad_projects');
}

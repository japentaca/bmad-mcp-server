import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const isPG = knex.client.config.client === 'pg';
  await knex.schema.createTable('bmad_activity_log', (t) => {
    t.bigIncrements('id').primary();
    if (isPG) {
      t.timestamp('timestamp', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    } else {
      t.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
    }
    t.string('level', 16).notNullable().defaultTo('info');
    t.string('category', 64).notNullable().defaultTo('system');
    t.string('action', 64).notNullable();
    t.string('entity_type', 64).nullable();
    t.string('entity_name', 256).nullable();
    t.string('project', 256).nullable();
    t.string('module', 64).nullable();
    t.text('user_message').nullable();
    t.text('request_body').nullable();
    t.text('response_summary').nullable();
    t.integer('response_size').unsigned().nullable();
    t.integer('duration_ms').unsigned().nullable();
    t.boolean('success').notNullable().defaultTo(true);
    t.string('error_code', 64).nullable();
    t.text('error_message').nullable();
    t.string('session_id', 128).nullable();
    t.string('client_id', 128).nullable();
    if (isPG) {
      t.jsonb('metadata').nullable().defaultTo('{}');
    } else {
      t.text('metadata').nullable().defaultTo('{}');
    }
  });

  if (isPG) {
    await knex.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_alog_timestamp ON bmad_activity_log(timestamp DESC)
    `);
  } else {
    await knex.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_alog_timestamp ON bmad_activity_log(timestamp)
    `);
  }

  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_alog_category ON bmad_activity_log(category, timestamp DESC)
  `);
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_alog_level ON bmad_activity_log(level, timestamp DESC)
  `);
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_alog_project ON bmad_activity_log(project, timestamp DESC)
  `);
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_alog_success ON bmad_activity_log(success, timestamp DESC)
  `);
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_alog_entity ON bmad_activity_log(entity_type, entity_name, timestamp DESC)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bmad_activity_log');
}

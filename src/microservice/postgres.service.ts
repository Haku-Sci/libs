import { Client } from "pg"; // Make sure the 'pg' package is installed

export async function createDatabaseIfNotExists() {
  const client = new Client({
    host: process.env[process.env.ENV_POSTGRESQL_HOST],
    port: process.env[process.env.ENV_POSTGRESQL_PORT],
    user: process.env[process.env.ENV_POSTGRESQL_USER],
    password: process.env[process.env.ENV_POSTGRESQL_PASSWORD],
    database: "postgres", // Connect to the default 'postgres' database
  });

  try {
    await client.connect();
    const result = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [process.env[process.env.ENV_POSTGRESQL_DB]]);

    if (result.rowCount === 0) {
      console.log(`Database "${process.env[process.env.ENV_POSTGRESQL_DB]}" does not exist. Creating...`);
      await client.query(`CREATE DATABASE "${process.env[process.env.ENV_POSTGRESQL_DB]}"`);
      console.log(`Database "${process.env[process.env.ENV_POSTGRESQL_DB]}" created successfully.`);
    }
  } finally {
    await client.end();
  }
}
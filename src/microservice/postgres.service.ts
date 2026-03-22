import { Client } from "pg"; // Make sure the 'pg' package is installed

export async function createDatabaseIfNotExists() {
  const client = new Client({
    host: process.env.SQL_HOST,
    port: Number(process.env.SQL_PORT),
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: "postgres", // Connect to the default 'postgres' database
  });

  try {
    await client.connect();
    const result = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [process.env.SQL_DB]);

    if (result.rowCount === 0) {
      console.log(`Database "${process.env.SQL_DB}" does not exist. Creating...`);
      await client.query(`CREATE DATABASE "${process.env.SQL_DB}"`);
      console.log(`Database "${process.env.SQL_DB}" created successfully.`);
    }
  } finally {
    await client.end();
  }
}

import { Client } from "pg"; // Make sure the 'pg' package is installed

export async function  createDatabaseIfNotExists() {
    const client = new Client({
      host: process.env["RDS_HOSTNAME"],
      port: process.env["RDS_PORT"],
      user: process.env["RDS_USERNAME"],
      password: process.env["RDS_PASSWORD"],
      database: "postgres", // Connect to the default 'postgres' database
    });

    try {
      await client.connect();
      const result = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [process.env["RDS_DBNAME"]]);

      if (result.rowCount === 0) {
        console.log(`Database "${process.env["RDS_DBNAME"]}" does not exist. Creating...`);
        await client.query(`CREATE DATABASE "${process.env["RDS_DBNAME"]}"`);
        console.log(`Database "${process.env["RDS_DBNAME"]}" created successfully.`);
      }
    } finally {
      await client.end();
    }
  }
import { Pool, QueryResultRow } from 'pg';
import { config } from '../config';

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  // 10 connections per worker process (cluster mode: N workers × 10 < PG max_connections=200)
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
  process.exit(-1);
});

export const query = <T extends QueryResultRow = any>(text: string, params?: any[]) =>
  pool.query<T>(text, params);

export const getClient = () => pool.connect();

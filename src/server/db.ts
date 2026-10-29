import fs from 'fs';
import path from 'path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

let SQL: SqlJsStatic | null = null;
let dbInstance: Database | null = null;
const DB_FILE_PATH = path.resolve(process.cwd(), 'quiz_system.sqlite');

export interface QueryResult<T = any> {
  rows: T[];
  changes: number;
  lastInsertRowid: number;
}

/**
 * Initializes the SQL.js database with foreign keys enabled
 * and loads persisted SQLite database file if it exists.
 */
export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (fs.existsSync(DB_FILE_PATH)) {
    const fileBuffer = fs.readFileSync(DB_FILE_PATH);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Enforce foreign key constraints
  dbInstance.run('PRAGMA foreign_keys = ON;');
  return dbInstance;
}

/**
 * Persists current in-memory SQLite state to disk
 */
export function persistDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE_PATH, buffer);
  } catch (err) {
    console.error('Failed to persist SQLite database to disk:', err);
  }
}

/**
 * Executes a SELECT query and returns an array of typed objects
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  
  if (params.length > 0) {
    stmt.bind(params);
  }

  const results: T[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as T;
    results.push(row);
  }
  stmt.free();
  return results;
}

/**
 * Executes a SELECT query expecting at most one record
 */
export async function get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

let inTransaction = false;

/**
 * Executes an INSERT, UPDATE, or DELETE query and auto-persists to disk
 */
export async function run(sql: string, params: any[] = []): Promise<{ lastInsertRowid: number; changes: number }> {
  const db = await getDb();
  
  // Use prepared statement to bind parameters securely
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();

  // Get last insert rowid and affected changes
  let lastInsertRowid = 0;
  let changes = 0;

  try {
    const idRes = db.exec('SELECT last_insert_rowid() as id, changes() as changes;');
    if (idRes.length > 0 && idRes[0].values.length > 0) {
      lastInsertRowid = Number(idRes[0].values[0][0]) || 0;
      changes = Number(idRes[0].values[0][1]) || 0;
    }
  } catch (err) {
    // Silently continue if rowid query is not supported for statement
  }

  if (!inTransaction) {
    persistDb();
  }
  return { lastInsertRowid, changes };
}

/**
 * Executes raw multi-statement SQL script (e.g., schema creation)
 */
export async function exec(sql: string): Promise<void> {
  const db = await getDb();
  db.exec(sql);
  if (!inTransaction) {
    persistDb();
  }
}

/**
 * Safely runs a transaction function with atomic commit or rollback
 */
export async function transaction<T>(callback: () => Promise<T>): Promise<T> {
  const db = await getDb();
  if (inTransaction) {
    return await callback();
  }

  inTransaction = true;
  db.run('BEGIN TRANSACTION;');
  try {
    const result = await callback();
    db.run('COMMIT;');
    inTransaction = false;
    persistDb();
    return result;
  } catch (error) {
    inTransaction = false;
    console.error('Transaction execution failed:', error);
    try {
      db.run('ROLLBACK;');
    } catch (rbErr) {
      // Ignore if transaction already rolled back
    }
    throw error;
  }
}

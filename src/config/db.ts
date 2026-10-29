import fs from 'fs';
import path from 'path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import mysql, { Pool } from 'mysql2/promise';
import bcrypt from 'bcryptjs';

let mysqlPool: Pool | null = null;
let sqlJsInstance: Database | null = null;
let sqlJsEngine: SqlJsStatic | null = null;
let inTransaction = false;

const DB_FILE = path.resolve(process.cwd(), 'quiz_database.sqlite');
const USE_MYSQL = Boolean(process.env.MYSQL_HOST || process.env.MYSQL_URL);

/**
 * Persists the SQL.js database buffer to disk
 */
function persistSqlJs() {
  if (!sqlJsInstance || inTransaction) return;
  try {
    const data = sqlJsInstance.export();
    fs.writeFileSync(DB_FILE, Buffer.from(data));
  } catch (err) {
    console.error('Failed to persist SQLite database to disk:', err);
  }
}

/**
 * Initializes MySQL pool or falls back to SQL.js
 */
export async function initializeDatabase(): Promise<void> {
  if (USE_MYSQL) {
    try {
      console.log('Connecting to MySQL host:', process.env.MYSQL_HOST || 'localhost');
      mysqlPool = mysql.createPool({
        host: process.env.MYSQL_HOST || 'localhost',
        port: Number(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'online_quiz_system',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      // Test connection
      const [rows] = await mysqlPool.query('SELECT 1 as connected');
      console.log('Successfully connected to MySQL database server.');
      return;
    } catch (err) {
      console.warn('MySQL connection failed or server not running. Falling back to embedded SQL engine:', err);
      mysqlPool = null;
    }
  }

  // Fallback / Default: Embedded SQL engine (sql.js)
  console.log('Initializing embedded Relational SQL database engine (3NF Schema)...');
  if (!sqlJsEngine) {
    sqlJsEngine = await initSqlJs();
  }

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    sqlJsInstance = new sqlJsEngine.Database(fileBuffer);
  } else {
    sqlJsInstance = new sqlJsEngine.Database();
  }

  // Enforce foreign key constraints
  sqlJsInstance.run('PRAGMA foreign_keys = ON;');

  // Create tables if not exists
  await createEmbeddedTables();
  console.log('Relational SQL database is ready and seeded.');
}

async function createEmbeddedTables() {
  if (!sqlJsInstance) return;

  const ddl = `
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK(role IN ('student', 'admin')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 10 CHECK(duration_minutes >= 1),
      passing_percentage REAL NOT NULL DEFAULT 70.0 CHECK(passing_percentage >= 0 AND passing_percentage <= 100),
      is_published INTEGER NOT NULL DEFAULT 1 CHECK(is_published IN (0, 1)),
      negative_marking_rate REAL DEFAULT 0.0,
      shuffle_questions INTEGER DEFAULT 0,
      available_from DATETIME,
      available_until DATETIME,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      explanation TEXT,
      marks INTEGER NOT NULL DEFAULT 1 CHECK(marks > 0),
      question_order INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS answer_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      option_text TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0 CHECK(is_correct IN (0, 1)),
      option_order INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      quiz_id INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      submitted_at INTEGER,
      status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'submitted', 'expired', 'abandoned')),
      tab_switches_count INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attempt_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      selected_option_id INTEGER,
      answered_at INTEGER,
      UNIQUE(attempt_id, question_id),
      FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
      FOREIGN KEY (selected_option_id) REFERENCES answer_options(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL UNIQUE,
      total_questions INTEGER NOT NULL,
      correct_answers INTEGER NOT NULL,
      incorrect_answers INTEGER NOT NULL,
      unanswered_questions INTEGER NOT NULL,
      total_marks INTEGER NOT NULL,
      marks_obtained REAL NOT NULL,
      negative_penalties REAL DEFAULT 0.0,
      percentage REAL NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0 CHECK(passed IN (0, 1)),
      certificate_code VARCHAR(64) UNIQUE,
      calculated_at INTEGER NOT NULL,
      FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE
    );
  `;

  sqlJsInstance.exec(ddl);

  // Safe migrations for existing SQLite file
  try { sqlJsInstance.exec('ALTER TABLE quizzes ADD COLUMN negative_marking_rate REAL DEFAULT 0.0;'); } catch(e) {}
  try { sqlJsInstance.exec('ALTER TABLE quizzes ADD COLUMN shuffle_questions INTEGER DEFAULT 0;'); } catch(e) {}
  try { sqlJsInstance.exec('ALTER TABLE quiz_attempts ADD COLUMN tab_switches_count INTEGER DEFAULT 0;'); } catch(e) {}
  try { sqlJsInstance.exec('ALTER TABLE quiz_results ADD COLUMN certificate_code VARCHAR(64);'); } catch(e) {}
  try { sqlJsInstance.exec('ALTER TABLE quiz_results ADD COLUMN negative_penalties REAL DEFAULT 0.0;'); } catch(e) {}

  // Check if users already seeded
  const usersCountStmt = sqlJsInstance.prepare('SELECT COUNT(*) as count FROM users;');
  usersCountStmt.step();
  const count = usersCountStmt.getAsObject().count as number;
  usersCountStmt.free();

  if (count === 0) {
    await seedEmbeddedData();
  }
}

async function seedEmbeddedData() {
  if (!sqlJsInstance) return;

  const adminHash = bcrypt.hashSync('AdminPassword123!', 10);
  const studentHash = bcrypt.hashSync('StudentPassword123!', 10);

  // Seed Users
  await run(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?);',
    ['Prof. Alan Turing (Admin)', 'admin@quizpulse.edu', adminHash, 'admin']
  );
  await run(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?);',
    ['Sarah Chen (Student)', 'student1@quizpulse.edu', studentHash, 'student']
  );
  await run(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?);',
    ['Marcus Brody (Student)', 'student2@quizpulse.edu', studentHash, 'student']
  );
  await run(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?);',
    ['Elena Rostova (Student)', 'student3@quizpulse.edu', studentHash, 'student']
  );

  // Seed Quizzes
  const q1 = await run(
    `INSERT INTO quizzes (title, description, duration_minutes, passing_percentage, is_published, created_by)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [
      'Relational Database Design & MySQL Engineering',
      'Comprehensive examination covering normalization (1NF, 2NF, 3NF), InnoDB storage engine, ACID transactions, B-Tree indexes, and multi-table joins.',
      10,
      75.0,
      1,
      1,
    ]
  );
  const q1Id = q1.insertId;

  const q2 = await run(
    `INSERT INTO quizzes (title, description, duration_minutes, passing_percentage, is_published, created_by)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [
      'Node.js & Express REST API Architecture',
      'Evaluation of asynchronous event loops, libuv, Express middleware pipeline, HTTP status code semantics, and error handling.',
      8,
      70.0,
      1,
      1,
    ]
  );
  const q2Id = q2.insertId;

  const q3 = await run(
    `INSERT INTO quizzes (title, description, duration_minutes, passing_percentage, is_published, created_by)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [
      'Web Application Security & OWASP Top 10',
      'Assessment of critical application security concepts: SQL Injection defenses, parameterized queries, bcrypt hashing, XSS, and CSRF mitigation.',
      10,
      80.0,
      1,
      1,
    ]
  );
  const q3Id = q3.insertId;

  const q4 = await run(
    `INSERT INTO quizzes (title, description, duration_minutes, passing_percentage, is_published, created_by)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [
      'Data Structures & Algorithmic Complexity',
      'Examination of time/space complexity, hash collisions, self-balancing binary search trees, and graph traversal strategies.',
      12,
      60.0,
      1,
      1,
    ]
  );
  const q4Id = q4.insertId;

  // Unpublished quiz draft
  await run(
    `INSERT INTO quizzes (title, description, duration_minutes, passing_percentage, is_published, created_by)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [
      'Distributed Systems & Microservices (Draft)',
      'Upcoming assessment covering Raft consensus, idempotency keys, CQRS, and message queues. Unpublished draft state.',
      15,
      75.0,
      0,
      1,
    ]
  );

  // Seed Questions and Options for Quiz 1
  const q1Questions = [
    {
      text: 'Which requirement must a database relation satisfy to strictly adhere to Third Normal Form (3NF)?',
      explanation: '3NF requires that the relation is in 2NF and contains no transitive functional dependencies of non-prime attributes on candidate keys.',
      marks: 2,
      options: [
        { text: 'It must be in 2NF and have no transitive functional dependencies of non-prime attributes on candidate keys.', correct: 1 },
        { text: 'Every non-prime attribute must depend on only a partial subset of a composite primary key.', correct: 0 },
        { text: 'All multi-valued attributes must be concatenated as comma-delimited strings in a single column.', correct: 0 },
        { text: 'The relation must not contain any foreign key constraints to other tables.', correct: 0 },
      ],
    },
    {
      text: 'What is the primary difference in result sets between an INNER JOIN and a LEFT OUTER JOIN?',
      explanation: 'An INNER JOIN returns only records with matches in both tables, whereas a LEFT JOIN retains all records from the left table and populates NULL for missing right-table columns.',
      marks: 2,
      options: [
        { text: 'LEFT JOIN preserves all rows from the left table regardless of right-table matches; INNER JOIN only returns rows with matches in both tables.', correct: 1 },
        { text: 'LEFT JOIN creates an unconditional Cartesian product of both tables.', correct: 0 },
        { text: 'INNER JOIN automatically updates unmatched right-table records with default values.', correct: 0 },
        { text: 'LEFT JOIN strips out NULL values from the output stream.', correct: 0 },
      ],
    },
    {
      text: 'In the context of the ACID properties of a MySQL transaction, what does the "Isolation" attribute guarantee?',
      explanation: 'Isolation guarantees that intermediate changes made by concurrent transactions remain hidden from other connections until committed.',
      marks: 2,
      options: [
        { text: 'Concurrent transaction execution yields identical state to serial execution without dirty reads or uncommitted writes.', correct: 1 },
        { text: 'Transaction logs are physically written to isolated storage disks.', correct: 0 },
        { text: 'Only one user connection can execute queries at any given instant.', correct: 0 },
        { text: 'Primary key constraints are disabled while the transaction executes.', correct: 0 },
      ],
    },
    {
      text: 'Why is a standard B-Tree index generally considered ineffective on a low-cardinality boolean status column?',
      explanation: 'Columns with very low cardinality (e.g. 2 values over 1M records) have low selectivity, causing the query optimizer to favor a full table scan over random index page lookups.',
      marks: 2,
      options: [
        { text: 'Low selectivity causes the MySQL query optimizer to determine that a full table scan is cheaper than tree index traversals.', correct: 1 },
        { text: 'MySQL crashes if a B-Tree index is configured on any column with fewer than 10 distinct values.', correct: 0 },
        { text: 'B-Tree indexes cannot physically store boolean integer data types.', correct: 0 },
        { text: 'Low cardinality columns can only be indexed using full-text search.', correct: 0 },
      ],
    },
    {
      text: 'What is the practical consequence of declaring a foreign key constraint with "ON DELETE CASCADE"?',
      explanation: 'Deleting a record in the referenced parent table automatically deletes all matching child records in the referencing table to maintain referential integrity.',
      marks: 2,
      options: [
        { text: 'Dependent child records in the referencing table are automatically deleted when the referenced parent record is deleted.', correct: 1 },
        { text: 'Parent records cannot be deleted as long as child records exist.', correct: 0 },
        { text: 'Child foreign key fields are populated with NULL values.', correct: 0 },
        { text: 'The deletion query is automatically reversed if it affects more than one row.', correct: 0 },
      ],
    },
  ];

  for (let i = 0; i < q1Questions.length; i++) {
    const qData = q1Questions[i];
    const qRes = await run(
      'INSERT INTO questions (quiz_id, question_text, explanation, marks, question_order) VALUES (?, ?, ?, ?, ?);',
      [q1Id, qData.text, qData.explanation, qData.marks, i + 1]
    );
    for (let j = 0; j < qData.options.length; j++) {
      const opt = qData.options[j];
      await run(
        'INSERT INTO answer_options (question_id, option_text, is_correct, option_order) VALUES (?, ?, ?, ?);',
        [qRes.insertId, opt.text, opt.correct, j + 1]
      );
    }
  }

  // Seed Questions for Quiz 2
  const q2Questions = [
    {
      text: 'How does the Node.js runtime process asynchronous I/O operations without blocking the single main JavaScript thread?',
      explanation: 'Node.js offloads asynchronous file and network operations to libuv and the underlying OS kernel, executing registered callbacks upon completion.',
      marks: 2,
      options: [
        { text: 'Asynchronous tasks are delegated to libuv and the OS kernel, with callbacks queued for the main event loop.', correct: 1 },
        { text: 'Node.js creates an entirely new operating system thread for each incoming HTTP connection.', correct: 0 },
        { text: 'All I/O operations block the CPU until completed.', correct: 0 },
        { text: 'JavaScript code is re-compiled to C++ synchronously.', correct: 0 },
      ],
    },
    {
      text: 'What occurs in an Express.js route handler if the function does not call next() and does not send a response?',
      explanation: 'The client HTTP request remains hanging indefinitely until the client or reverse proxy reaches a socket timeout.',
      marks: 2,
      options: [
        { text: 'The connection remains open and hangs until client or gateway timeout.', correct: 1 },
        { text: 'Express automatically terminates with a 404 response.', correct: 0 },
        { text: 'The server crashes with an uncaught exception.', correct: 0 },
        { text: 'The router retries the handler automatically.', correct: 0 },
      ],
    },
    {
      text: 'What exact function signature must an Express middleware declare to be recognized as an error handler?',
      explanation: 'Express inspects function.length. Error middleware must declare exactly 4 arguments: (err, req, res, next).',
      marks: 2,
      options: [
        { text: '(err, req, res, next)', correct: 1 },
        { text: '(req, res, next, err)', correct: 0 },
        { text: '(err, req, res)', correct: 0 },
        { text: '(req, res, err)', correct: 0 },
      ],
    },
    {
      text: 'Which HTTP status code is most suitable when a student attempts to submit a quiz after its server timer has expired?',
      explanation: 'HTTP 403 Forbidden or 400 Bad Request clearly conveys that the examination window has lapsed and submission is disallowed.',
      marks: 2,
      options: [
        { text: '403 Forbidden or 400 Bad Request', correct: 1 },
        { text: '502 Bad Gateway', correct: 0 },
        { text: '304 Not Modified', correct: 0 },
        { text: '204 No Content', correct: 0 },
      ],
    },
    {
      text: 'What is the security rationale for setting the "HttpOnly" flag on authentication cookies?',
      explanation: 'HttpOnly prevents client-side JavaScript (e.g. document.cookie) from accessing the session token, mitigating theft via XSS.',
      marks: 2,
      options: [
        { text: 'It prevents client scripts from reading the cookie, protecting against token theft via Cross-Site Scripting (XSS).', correct: 1 },
        { text: 'It encrypts the cookie using TLS before sending it to the browser.', correct: 0 },
        { text: 'It forces the browser to send the cookie over plain HTTP only.', correct: 0 },
        { text: 'It automatically refreshes the token on every page reload.', correct: 0 },
      ],
    },
  ];

  for (let i = 0; i < q2Questions.length; i++) {
    const qData = q2Questions[i];
    const qRes = await run(
      'INSERT INTO questions (quiz_id, question_text, explanation, marks, question_order) VALUES (?, ?, ?, ?, ?);',
      [q2Id, qData.text, qData.explanation, qData.marks, i + 1]
    );
    for (let j = 0; j < qData.options.length; j++) {
      const opt = qData.options[j];
      await run(
        'INSERT INTO answer_options (question_id, option_text, is_correct, option_order) VALUES (?, ?, ?, ?);',
        [qRes.insertId, opt.text, opt.correct, j + 1]
      );
    }
  }

  // Seed sample attempts for Sarah Chen and Marcus
  const now = Date.now();
  const att1 = await run(
    `INSERT INTO quiz_attempts (user_id, quiz_id, started_at, expires_at, submitted_at, status)
     VALUES (?, ?, ?, ?, ?, 'submitted');`,
    [2, q1Id, now - 3600000, now - 3600000 + 600000, now - 3600000 + 210000]
  );
  await run(
    `INSERT INTO quiz_results (attempt_id, total_questions, correct_answers, incorrect_answers, unanswered_questions, total_marks, marks_obtained, percentage, passed, calculated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?);`,
    [att1.insertId, 5, 5, 0, 0, 10, 10, 100.0, now - 3600000 + 210000]
  );

  const att2 = await run(
    `INSERT INTO quiz_attempts (user_id, quiz_id, started_at, expires_at, submitted_at, status)
     VALUES (?, ?, ?, ?, ?, 'submitted');`,
    [3, q1Id, now - 7200000, now - 7200000 + 600000, now - 7200000 + 340000]
  );
  await run(
    `INSERT INTO quiz_results (attempt_id, total_questions, correct_answers, incorrect_answers, unanswered_questions, total_marks, marks_obtained, percentage, passed, calculated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?);`,
    [att2.insertId, 5, 4, 1, 0, 10, 8, 80.0, now - 7200000 + 340000]
  );

  persistSqlJs();
}

/**
 * Executes a SELECT query and returns an array of typed row objects
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (mysqlPool) {
    const [rows] = await mysqlPool.query(sql, params);
    return rows as T[];
  }

  if (!sqlJsInstance) {
    await initializeDatabase();
  }

  const stmt = sqlJsInstance!.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
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

/**
 * Executes an INSERT, UPDATE, or DELETE query
 */
export async function run(sql: string, params: any[] = []): Promise<{ insertId: number; affectedRows: number }> {
  if (mysqlPool) {
    const [result] = await mysqlPool.execute(sql, params) as any;
    return {
      insertId: result.insertId || 0,
      affectedRows: result.affectedRows || 0,
    };
  }

  if (!sqlJsInstance) {
    await initializeDatabase();
  }

  const stmt = sqlJsInstance!.prepare(sql);
  stmt.run(params);
  stmt.free();

  let insertId = 0;
  let affectedRows = 0;

  try {
    const idRes = sqlJsInstance!.exec('SELECT last_insert_rowid() as id, changes() as changes;');
    if (idRes.length > 0 && idRes[0].values.length > 0) {
      insertId = Number(idRes[0].values[0][0]) || 0;
      affectedRows = Number(idRes[0].values[0][1]) || 0;
    }
  } catch (err) {
    // Ignore
  }

  if (!inTransaction) {
    persistSqlJs();
  }

  return { insertId, affectedRows };
}

/**
 * Atomic transaction execution with commit or rollback
 */
export async function transaction<T>(callback: () => Promise<T>): Promise<T> {
  if (mysqlPool) {
    const connection = await mysqlPool.getConnection();
    await connection.beginTransaction();
    try {
      const result = await callback();
      await connection.commit();
      return result;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  if (!sqlJsInstance) {
    await initializeDatabase();
  }

  if (inTransaction) {
    return await callback();
  }

  inTransaction = true;
  sqlJsInstance!.run('BEGIN TRANSACTION;');
  try {
    const result = await callback();
    sqlJsInstance!.run('COMMIT;');
    inTransaction = false;
    persistSqlJs();
    return result;
  } catch (err) {
    inTransaction = false;
    try {
      sqlJsInstance!.run('ROLLBACK;');
    } catch (rbErr) {
      // Ignore
    }
    throw err;
  }
}

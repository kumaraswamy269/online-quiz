import { exec, get, query, run, transaction } from './db.ts';

export async function initializeDatabase(): Promise<void> {
  // Read and execute schema definition
  const schemaSql = `
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(100) NOT NULL UNIQUE,
      slug VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      icon VARCHAR(50) DEFAULT 'Layers',
      color VARCHAR(50) DEFAULT 'indigo',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      time_limit_seconds INTEGER NOT NULL DEFAULT 600 CHECK(time_limit_seconds >= 30),
      pass_percentage INTEGER NOT NULL DEFAULT 70 CHECK(pass_percentage >= 0 AND pass_percentage <= 100),
      difficulty VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK(difficulty IN ('easy', 'medium', 'hard')),
      is_published INTEGER NOT NULL DEFAULT 1 CHECK(is_published IN (0, 1)),
      shuffle_questions INTEGER NOT NULL DEFAULT 0 CHECK(shuffle_questions IN (0, 1)),
      negative_marking_rate REAL DEFAULT 0.0,
      topic VARCHAR(100) DEFAULT 'General',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_quizzes_category_id ON quizzes(category_id);
    CREATE INDEX IF NOT EXISTS idx_quizzes_is_published ON quizzes(is_published);

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      explanation TEXT,
      points INTEGER NOT NULL DEFAULT 1 CHECK(points > 0),
      sort_order INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);

    CREATE TABLE IF NOT EXISTS question_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      option_text TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0 CHECK(is_correct IN (0, 1)),
      sort_order INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_options_question_id ON question_options(question_id);
    CREATE INDEX IF NOT EXISTS idx_options_is_correct ON question_options(question_id, is_correct);

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_token VARCHAR(64) NOT NULL UNIQUE,
      quiz_id INTEGER NOT NULL,
      user_name VARCHAR(100) NOT NULL,
      user_email VARCHAR(150) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed', 'expired', 'abandoned')),
      started_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      completed_at INTEGER,
      time_taken_seconds INTEGER DEFAULT 0,
      score INTEGER DEFAULT 0,
      max_score INTEGER DEFAULT 0,
      percentage REAL DEFAULT 0.0,
      passed INTEGER DEFAULT 0 CHECK(passed IN (0, 1)),
      total_questions INTEGER DEFAULT 0,
      correct_answers_count INTEGER DEFAULT 0,
      incorrect_answers_count INTEGER DEFAULT 0,
      unanswered_count INTEGER DEFAULT 0,
      tab_switches_count INTEGER DEFAULT 0,
      certificate_code VARCHAR(32),
      negative_penalties REAL DEFAULT 0.0,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_attempts_token ON quiz_attempts(session_token);
    CREATE INDEX IF NOT EXISTS idx_attempts_quiz_id ON quiz_attempts(quiz_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_status ON quiz_attempts(status);

    CREATE TABLE IF NOT EXISTS attempt_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      selected_option_id INTEGER,
      is_correct INTEGER DEFAULT 0 CHECK(is_correct IN (0, 1)),
      points_awarded INTEGER DEFAULT 0,
      answered_at INTEGER,
      UNIQUE(attempt_id, question_id),
      FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
      FOREIGN KEY (selected_option_id) REFERENCES question_options(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt ON attempt_answers(attempt_id);
    CREATE INDEX IF NOT EXISTS idx_attempt_answers_question ON attempt_answers(question_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await exec(schemaSql);

  // Safe migrations for new advanced examination features
  try { await run('ALTER TABLE quizzes ADD COLUMN negative_marking_rate REAL DEFAULT 0.0;'); } catch (_) {}
  try { await run("ALTER TABLE quizzes ADD COLUMN topic VARCHAR(100) DEFAULT 'General';"); } catch (_) {}
  try { await run("CREATE INDEX IF NOT EXISTS idx_quizzes_topic ON quizzes(topic);"); } catch (_) {}
  try { await run('ALTER TABLE quiz_attempts ADD COLUMN tab_switches_count INTEGER DEFAULT 0;'); } catch (_) {}
  try { await run('ALTER TABLE quiz_attempts ADD COLUMN certificate_code VARCHAR(32);'); } catch (_) {}
  try { await run('ALTER TABLE quiz_attempts ADD COLUMN negative_penalties REAL DEFAULT 0.0;'); } catch (_) {}

  // Check if categories already seeded
  const existingCategory = await get<{ count: number }>('SELECT COUNT(*) as count FROM categories;');
  if (!existingCategory || existingCategory.count === 0) {
    await seedInitialData();
  }

  // Ensure topics and curriculum quizzes are fully seeded across all categories
  await ensureTopicsAndQuizzesSeeded();
}

export async function seedInitialData(): Promise<void> {
  await transaction(async () => {
    // 1. Seed Categories
    const categoriesData = [
      {
        name: 'Database Systems & SQL',
        slug: 'database-systems-sql',
        description: 'Relational database architecture, normalization, ACID properties, joins, and indexing.',
        icon: 'Database',
        color: 'emerald',
      },
      {
        name: 'Backend Architecture & Node.js',
        slug: 'backend-architecture-node',
        description: 'Server design, Express.js middleware, event loop, APIs, and RESTful best practices.',
        icon: 'Server',
        color: 'blue',
      },
      {
        name: 'Web Security & Authentication',
        slug: 'web-security-auth',
        description: 'OWASP top 10 vulnerabilities, session tokens, SQL injection defense, and cryptographic hashing.',
        icon: 'ShieldCheck',
        color: 'rose',
      },
      {
        name: 'Algorithms & Data Structures',
        slug: 'algorithms-data-structures',
        description: 'Time complexity analysis, trees, hash maps, graph traversal, and dynamic programming.',
        icon: 'Binary',
        color: 'amber',
      },
    ];

    const categoryMap = new Map<string, number>();

    for (const cat of categoriesData) {
      const res = await run(
        'INSERT INTO categories (name, slug, description, icon, color) VALUES (?, ?, ?, ?, ?);',
        [cat.name, cat.slug, cat.description, cat.icon, cat.color]
      );
      categoryMap.set(cat.slug, res.lastInsertRowid);
    }

    // 2. Seed Quizzes & Questions
    // Quiz 1: Relational Database & SQL Mastery
    const dbCatId = categoryMap.get('database-systems-sql')!;
    const quiz1 = await run(
      `INSERT INTO quizzes (category_id, title, slug, description, time_limit_seconds, pass_percentage, difficulty, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        dbCatId,
        'Relational Database & SQL Engineering',
        'relational-database-sql-engineering',
        'Demonstrate your mastery of Third Normal Form (3NF), relational algebra, ACID guarantees, composite keys, and indexing mechanics.',
        420, // 7 minutes
        75,
        'medium',
        1,
      ]
    );
    const q1Id = quiz1.lastInsertRowid;

    // Questions for Quiz 1
    const q1Questions = [
      {
        text: 'Which condition must a relational table satisfy to strictly achieve Third Normal Form (3NF)?',
        points: 2,
        explanation: '3NF requires that the table is in 2NF and contains no transitive dependencies (every non-key attribute is non-transitively dependent on the primary key).',
        options: [
          { text: 'It must be in 2NF and have no transitive functional dependencies of non-prime attributes on candidate keys.', correct: true },
          { text: 'Every non-key attribute must depend on only a subset of a composite primary key.', correct: false },
          { text: 'All multivalued attributes must be aggregated into a single delimited text column.', correct: false },
          { text: 'There must be no repeating groups or composite columns in the table.', correct: false },
        ],
      },
      {
        text: 'In SQL, what is the key difference between a LEFT JOIN and an INNER JOIN?',
        points: 2,
        explanation: 'An INNER JOIN returns only records that have matching keys in both tables, whereas a LEFT JOIN retains all rows from the left table and populates NULLs when no match exists on the right.',
        options: [
          { text: 'LEFT JOIN returns all matching rows from both tables, while INNER JOIN creates a cartesian product.', correct: false },
          { text: 'LEFT JOIN preserves all rows from the left table even if there is no match in the right table; INNER JOIN only returns rows with matches in both.', correct: true },
          { text: 'INNER JOIN automatically updates the right table with default column constraints.', correct: false },
          { text: 'LEFT JOIN suppresses NULL values from appearing in the resulting record set.', correct: false },
        ],
      },
      {
        text: 'What does the "I" (Isolation) in ACID transaction principles guarantee?',
        points: 2,
        explanation: 'Isolation ensures that concurrent transactions execute as if they were running serially without interfering with one another or reading uncommitted dirty writes.',
        options: [
          { text: 'Intermediate state changes made by concurrent transactions are hidden from other operations until committed.', correct: true },
          { text: 'The transaction logs are immediately mirrored across isolated physical disks.', correct: false },
          { text: 'Only a single user can access the database server at any given point in time.', correct: false },
          { text: 'Integrity constraints like foreign keys cannot be modified by any query.', correct: false },
        ],
      },
      {
        text: 'When should a B-Tree index generally NOT be placed on a database column?',
        points: 1,
        explanation: 'Columns with low cardinality (e.g., boolean flags or gender with very few distinct values) provide poor selectivity for B-Trees and degrade write performance.',
        options: [
          { text: 'On columns with very low cardinality (e.g. a boolean flag with 2 distinct values over 1M rows).', correct: true },
          { text: 'On foreign key columns that are frequently used in WHERE and JOIN clauses.', correct: false },
          { text: 'On unique columns used for frequent equality lookups.', correct: false },
          { text: 'On timestamp columns used in date-range filtering.', correct: false },
        ],
      },
      {
        text: 'What is the effect of an "ON DELETE CASCADE" clause on a Foreign Key definition?',
        points: 2,
        explanation: 'When a referenced row in the parent table is deleted, all corresponding child rows referencing that row are automatically deleted to maintain referential integrity.',
        options: [
          { text: 'It prevents the parent row from being deleted if any child rows reference it.', correct: false },
          { text: 'It automatically deletes dependent child rows when the referenced parent row is deleted.', correct: true },
          { text: 'It sets foreign key columns in child rows to NULL without deleting them.', correct: false },
          { text: 'It creates a backup snapshot of the table in an archival log.', correct: false },
        ],
      },
    ];

    for (let i = 0; i < q1Questions.length; i++) {
      const q = q1Questions[i];
      const qRes = await run(
        'INSERT INTO questions (quiz_id, question_text, explanation, points, sort_order) VALUES (?, ?, ?, ?, ?);',
        [q1Id, q.text, q.explanation, q.points, i + 1]
      );
      const questionId = qRes.lastInsertRowid;
      for (let j = 0; j < q.options.length; j++) {
        const opt = q.options[j];
        await run(
          'INSERT INTO question_options (question_id, option_text, is_correct, sort_order) VALUES (?, ?, ?, ?);',
          [questionId, opt.text, opt.correct ? 1 : 0, j + 1]
        );
      }
    }

    // Quiz 2: Node.js & Express Architecture
    const nodeCatId = categoryMap.get('backend-architecture-node')!;
    const quiz2 = await run(
      `INSERT INTO quizzes (category_id, title, slug, description, time_limit_seconds, pass_percentage, difficulty, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        nodeCatId,
        'Node.js & Express.js Backend Architecture',
        'nodejs-express-backend-architecture',
        'Test your deep understanding of the Node.js event loop, asynchronous I/O, Express middleware chaining, and server performance.',
        300, // 5 minutes
        70,
        'easy',
        1,
      ]
    );
    const q2Id = quiz2.lastInsertRowid;

    const q2Questions = [
      {
        text: 'How does the Node.js event loop handle asynchronous non-blocking I/O operations (like disk reads or database queries)?',
        points: 2,
        explanation: 'Node.js delegates I/O tasks to libuv background thread pool or kernel asynchronous primitives, allowing the main JavaScript single thread to continue processing without blocking.',
        options: [
          { text: 'It spawns a new OS thread for every incoming HTTP request.', correct: false },
          { text: 'It delegates I/O to libuv thread pool / kernel events and executes registered callbacks on the single main thread upon completion.', correct: true },
          { text: 'It halts all execution until the operating system completes the file descriptor read.', correct: false },
          { text: 'It converts all asynchronous operations into synchronous recursive loops.', correct: false },
        ],
      },
      {
        text: 'What happens in Express.js if a middleware does not call next() and does not send a response?',
        points: 1,
        explanation: 'If next() is not called and no response is closed with res.send/res.json, the HTTP request hangs indefinitely until the client or gateway times out.',
        options: [
          { text: 'Express automatically returns a 404 Not Found error.', correct: false },
          { text: 'The request is left hanging indefinitely until the connection reaches a client or gateway timeout.', correct: true },
          { text: 'The server crashes with an UnhandledPromiseRejection error.', correct: false },
          { text: 'Express falls back to the static file server route.', correct: false },
        ],
      },
      {
        text: 'In Express error handling middleware, what is the mandatory signature required by the framework to recognize it as an error handler?',
        points: 2,
        explanation: 'Express inspects function.length. Error middleware MUST declare exactly 4 parameters: (err, req, res, next).',
        options: [
          { text: '(err, req, res, next)', correct: true },
          { text: '(req, res, next, error)', correct: false },
          { text: '(error, req, res)', correct: false },
          { text: '(req, res, err)', correct: false },
        ],
      },
      {
        text: 'Which HTTP status code is most appropriate when a client attempts to submit answers to a quiz after its timer has expired?',
        points: 1,
        explanation: '403 Forbidden or 410 Gone indicates the resource or session window has permanently lapsed, while 400 Bad Request indicates an expired state failure.',
        options: [
          { text: '403 Forbidden or 400 Bad Request indicating the quiz attempt session has expired.', correct: true },
          { text: '502 Bad Gateway', correct: false },
          { text: '304 Not Modified', correct: false },
          { text: '204 No Content', correct: false },
        ],
      },
    ];

    for (let i = 0; i < q2Questions.length; i++) {
      const q = q2Questions[i];
      const qRes = await run(
        'INSERT INTO questions (quiz_id, question_text, explanation, points, sort_order) VALUES (?, ?, ?, ?, ?);',
        [q2Id, q.text, q.explanation, q.points, i + 1]
      );
      const questionId = qRes.lastInsertRowid;
      for (let j = 0; j < q.options.length; j++) {
        const opt = q.options[j];
        await run(
          'INSERT INTO question_options (question_id, option_text, is_correct, sort_order) VALUES (?, ?, ?, ?);',
          [questionId, opt.text, opt.correct ? 1 : 0, j + 1]
        );
      }
    }

    // Quiz 3: Web Security & Defense
    const secCatId = categoryMap.get('web-security-auth')!;
    const quiz3 = await run(
      `INSERT INTO quizzes (category_id, title, slug, description, time_limit_seconds, pass_percentage, difficulty, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        secCatId,
        'Web Security & Defending Online Applications',
        'web-security-defending-online-applications',
        'Assess critical security principles including parameterized queries, CSRF mitigations, JWT best practices, and rate limiting.',
        360, // 6 minutes
        80,
        'hard',
        1,
      ]
    );
    const q3Id = quiz3.lastInsertRowid;

    const q3Questions = [
      {
        text: 'Why do parameterized queries (prepared statements) fundamentally prevent SQL Injection attacks?',
        points: 2,
        explanation: 'Prepared statements separate the SQL code from user data; parameters are sent out-of-band and treated strictly as literal values rather than executable syntax.',
        options: [
          { text: 'They treat user input strictly as literal parameter data, ensuring input strings can never alter the SQL command structure.', correct: true },
          { text: 'They encrypt the SQL queries using AES-256 before sending them to the database engine.', correct: false },
          { text: 'They strip out all single quote and semicolon characters from every input string.', correct: false },
          { text: 'They cache the queries in memory so the database server never has to re-parse SQL.', correct: false },
        ],
      },
      {
        text: 'Why should correct quiz answers NEVER be sent to the client browser during an active assessment, even if hidden with CSS?',
        points: 2,
        explanation: 'Any data transmitted over the network to the browser can be easily inspected using browser DevTools (Network tab, DOM inspector, or JavaScript memory dump).',
        options: [
          { text: 'Any data sent to the client can be trivially inspected via browser DevTools, memory, or network inspect panels.', correct: true },
          { text: 'Sending correct answers causes excessive HTML document size that blocks the rendering thread.', correct: false },
          { text: 'Browsers automatically submit correct answers to Google search indexers.', correct: false },
          { text: 'CSS display:none properties are deprecated in modern HTTP/3 standards.', correct: false },
        ],
      },
      {
        text: 'What is the purpose of the "HttpOnly" attribute when setting authentication cookies?',
        points: 1,
        explanation: 'HttpOnly prevents client-side JavaScript (e.g. document.cookie) from accessing the cookie, effectively mitigating token theft via Cross-Site Scripting (XSS).',
        options: [
          { text: 'It prevents client-side scripts from reading the cookie, mitigating credential theft via XSS.', correct: true },
          { text: 'It ensures the cookie can only be sent over unencrypted HTTP connections.', correct: false },
          { text: 'It compresses the cookie payload to minimize network bandwidth.', correct: false },
          { text: 'It automatically refreshes the token whenever a network request fails.', correct: false },
        ],
      },
    ];

    for (let i = 0; i < q3Questions.length; i++) {
      const q = q3Questions[i];
      const qRes = await run(
        'INSERT INTO questions (quiz_id, question_text, explanation, points, sort_order) VALUES (?, ?, ?, ?, ?);',
        [q3Id, q.text, q.explanation, q.points, i + 1]
      );
      const questionId = qRes.lastInsertRowid;
      for (let j = 0; j < q.options.length; j++) {
        const opt = q.options[j];
        await run(
          'INSERT INTO question_options (question_id, option_text, is_correct, sort_order) VALUES (?, ?, ?, ?);',
          [questionId, opt.text, opt.correct ? 1 : 0, j + 1]
        );
      }
    }

    // Seed sample attempts for leaderboard and analytics demonstrability
    const sampleAttempts = [
      {
        user_name: 'Sarah Chen (Senior Dev)',
        user_email: 'sarah.chen@example.com',
        time: 142,
        score: 9,
        max: 9,
        percentage: 100.0,
        passed: 1,
        status: 'completed',
      },
      {
        user_name: 'Marcus Brody',
        user_email: 'marcus.b@example.com',
        time: 210,
        score: 7,
        max: 9,
        percentage: 77.8,
        passed: 1,
        status: 'completed',
      },
      {
        user_name: 'Elena Rostova',
        user_email: 'elena.r@example.com',
        time: 320,
        score: 5,
        max: 9,
        percentage: 55.6,
        passed: 0,
        status: 'completed',
      },
    ];

    const now = Date.now();
    for (const sa of sampleAttempts) {
      await run(
        `INSERT INTO quiz_attempts (
          session_token, quiz_id, user_name, user_email, status,
          started_at, expires_at, completed_at, time_taken_seconds,
          score, max_score, percentage, passed, total_questions,
          correct_answers_count, incorrect_answers_count, unanswered_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          `sample-session-${Math.random().toString(36).substring(2, 10)}`,
          q1Id,
          sa.user_name,
          sa.user_email,
          sa.status,
          now - 3600000,
          now - 3600000 + 420000,
          now - 3600000 + sa.time * 1000,
          sa.time,
          sa.score,
          sa.max,
          sa.percentage,
          sa.passed,
          5,
          Math.floor((sa.score / sa.max) * 5),
          5 - Math.floor((sa.score / sa.max) * 5),
          0,
        ]
      );
    }

    // Log seed event
    await run(
      'INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?);',
      ['SEED_INIT', 'SYSTEM', 0, 'Database populated with initial schema and 3 curriculum quizzes.']
    );
  });
}

export async function ensureTopicsAndQuizzesSeeded(): Promise<void> {
  // 1. Update existing quizzes with descriptive curriculum topics
  try {
    await run("UPDATE quizzes SET topic = 'Relational Normalization & 3NF' WHERE slug LIKE '%relational%' AND (topic IS NULL OR topic = 'General');");
    await run("UPDATE quizzes SET topic = 'Event Loop & Async I/O' WHERE slug LIKE '%node%' AND (topic IS NULL OR topic = 'General');");
    await run("UPDATE quizzes SET topic = 'OWASP Top 10 & Injection' WHERE slug LIKE '%security%' AND (topic IS NULL OR topic = 'General');");
  } catch (_) {}

  // 2. Fetch or seed all standard categories
  const defaultCategories = [
    {
      name: 'Database Systems & SQL',
      slug: 'database-systems-sql',
      description: 'Relational database architecture, normalization, ACID properties, joins, and indexing.',
      icon: 'Database',
      color: 'emerald',
    },
    {
      name: 'Backend Architecture & Node.js',
      slug: 'backend-architecture-node',
      description: 'Server design, Express.js middleware, event loop, APIs, and RESTful best practices.',
      icon: 'Server',
      color: 'blue',
    },
    {
      name: 'Web Security & Authentication',
      slug: 'web-security-auth',
      description: 'OWASP top 10 vulnerabilities, session tokens, SQL injection defense, and cryptographic hashing.',
      icon: 'ShieldCheck',
      color: 'rose',
    },
    {
      name: 'Algorithms & Data Structures',
      slug: 'algorithms-data-structures',
      description: 'Time complexity analysis, trees, hash maps, graph traversal, and dynamic programming.',
      icon: 'Binary',
      color: 'amber',
    },
  ];

  const catMap = new Map<string, number>();
  for (const dc of defaultCategories) {
    const existing = await get<{ id: number }>('SELECT id FROM categories WHERE slug = ?;', [dc.slug]);
    if (!existing) {
      const res = await run(
        'INSERT INTO categories (name, slug, description, icon, color) VALUES (?, ?, ?, ?, ?);',
        [dc.name, dc.slug, dc.description, dc.icon, dc.color]
      );
      catMap.set(dc.slug, res.lastInsertRowid);
    } else {
      catMap.set(dc.slug, existing.id);
    }
  }

  // Update quiz 1 to point to database-systems-sql
  const dbCatId = catMap.get('database-systems-sql');
  if (dbCatId) {
    await run('UPDATE quizzes SET category_id = ? WHERE slug LIKE "%relational%";', [dbCatId]);
  }

  const additionalQuizzes = [
    {
      categorySlug: 'database-systems-sql',
      title: 'B-Tree Indexing & Query Optimization',
      slug: 'b-tree-indexing-query-optimization',
      description: 'Master B-Tree internal nodes, leftmost prefix rules for composite indexes, EXPLAIN plan interpretation, and clustered vs secondary indexes.',
      timeLimit: 360,
      passPercentage: 75,
      difficulty: 'hard',
      topic: 'Indexing & Query Performance',
      questions: [
        {
          text: 'How does a composite index on (department_id, salary) behave according to the Leftmost Prefix rule in B-Tree indexes?',
          points: 2,
          explanation: 'B-Tree composite indexes can only be utilized from left to right. Without the leading column (department_id), the tree cannot be traversed to locate salary values efficiently.',
          options: [
            { text: 'Queries filtering by department_id alone or (department_id AND salary) can use the index, but queries filtering solely by salary cannot.', correct: true },
            { text: 'The index can only be used if all columns in the table are included in the SELECT clause.', correct: false },
            { text: 'Queries filtering by salary alone will perform faster than queries filtering by department_id.', correct: false },
            { text: 'Composite indexes in B-Trees automatically invert column order based on frequency.', correct: false },
          ],
        },
        {
          text: 'What is the primary indicator in an EXPLAIN query plan that a query is causing an unindexed full table scan?',
          points: 2,
          explanation: 'In MySQL and relational execution plans, type: "ALL" signifies that every page of the table is scanned sequentially without using any index.',
          options: [
            { text: 'type column shows "ALL" with possible_keys as NULL', correct: true },
            { text: 'type column shows "const" with Extra "Using index"', correct: false },
            { text: 'type column shows "ref" with key_len greater than 100', correct: false },
            { text: 'Extra column shows "Using where with index condition pushdown"', correct: false },
          ],
        },
        {
          text: 'What distinguishes a Clustered Index from a Secondary (Non-Clustered) Index in InnoDB?',
          points: 2,
          explanation: 'In InnoDB, the primary key forms the clustered index whose leaf pages directly store complete table rows. Secondary indexes map indexed column values to the primary key.',
          options: [
            { text: 'The leaf nodes of a clustered index contain the actual physical table row data, whereas secondary indexes store the primary key value as a pointer.', correct: true },
            { text: 'Clustered indexes are stored exclusively in RAM, while secondary indexes reside on disk.', correct: false },
            { text: 'A table can contain up to 16 clustered indexes, but only one secondary index.', correct: false },
            { text: 'Clustered indexes do not support B-Tree branch nodes.', correct: false },
          ],
        },
      ],
    },
    {
      categorySlug: 'database-systems-sql',
      title: 'ACID Concurrency & Transaction Isolation',
      slug: 'acid-concurrency-transactions',
      description: 'Deep dive into Read Committed vs Repeatable Read isolation levels, dirty reads, two-phase locking, and Write-Ahead Logging (WAL).',
      timeLimit: 300,
      passPercentage: 70,
      difficulty: 'medium',
      topic: 'Transactions & ACID Guarantees',
      questions: [
        {
          text: 'What phenomenon occurs in the "Read Committed" isolation level that is prevented in "Repeatable Read"?',
          points: 2,
          explanation: 'Repeatable Read uses snapshot MVCC reads so that repeatedly reading a row within the same transaction produces consistent snapshot data even if concurrent transactions commit updates.',
          options: [
            { text: 'Non-repeatable read: reading the same row twice within a transaction yields different values if another transaction committed changes between the reads.', correct: true },
            { text: 'Dirty write: uncommitted memory is flushed to permanent disk.', correct: false },
            { text: 'Deadlock: two transactions wait on the same record lock indefinitely.', correct: false },
            { text: 'Phantom read on primary key uniqueness checks.', correct: false },
          ],
        },
        {
          text: 'What is Write-Ahead Logging (WAL) and how does it guarantee Durability (the "D" in ACID)?',
          points: 2,
          explanation: 'WAL ensures that if a crash occurs before dirty data pages in the buffer pool are written to disk, the committed transactions can be safely recovered from the sequential log.',
          options: [
            { text: 'Changes are recorded in an append-only transaction redo log before dirty data pages are flushed to table data files.', correct: true },
            { text: 'All read queries are written to an audit log before fetching rows.', correct: false },
            { text: 'Transaction rollback scripts are pre-compiled and saved in memory.', correct: false },
            { text: 'The database server creates a full duplicate copy of every table before every INSERT.', correct: false },
          ],
        },
      ],
    },
    {
      categorySlug: 'backend-architecture-node',
      title: 'RESTful API Architecture & HTTP Standards',
      slug: 'restful-api-http-standards',
      description: 'Evaluate HTTP 1.1/2 standards, idempotency rules for PUT vs POST, status code semantics (201, 409, 422), and CORS preflight headers.',
      timeLimit: 300,
      passPercentage: 75,
      difficulty: 'medium',
      topic: 'REST API Design & Protocols',
      questions: [
        {
          text: 'Which HTTP methods are defined as idempotent according to RFC 7231 specifications?',
          points: 2,
          explanation: 'Idempotent methods can be executed multiple times with identical server-side state effect: GET, HEAD, PUT, and DELETE are idempotent; POST is not.',
          options: [
            { text: 'GET, HEAD, PUT, and DELETE', correct: true },
            { text: 'POST and PATCH only', correct: false },
            { text: 'POST, PUT, and CONNECT', correct: false },
            { text: 'Only GET and OPTIONS', correct: false },
          ],
        },
        {
          text: 'What is the semantic purpose of returning HTTP 409 Conflict in a quiz submission endpoint?',
          points: 2,
          explanation: '409 Conflict signals that the request cannot be completed due to a conflict with the current state of the target resource (e.g., attempt already submitted or expired).',
          options: [
            { text: 'To indicate the quiz attempt was already finalized or submitted, preventing duplicate processing.', correct: true },
            { text: 'To inform the client that their authentication token has expired.', correct: false },
            { text: 'To indicate that the database connection pool is depleted.', correct: false },
            { text: 'To signal that the requested URL route has changed permanently.', correct: false },
          ],
        },
      ],
    },
    {
      categorySlug: 'web-security-auth',
      title: 'Modern Authentication, JWT & Password Hashing',
      slug: 'auth-jwt-password-hashing',
      description: 'Examine bcrypt key stretching, salt generation, JWT signature algorithms, HttpOnly cookie protection, and CSRF defense mechanisms.',
      timeLimit: 360,
      passPercentage: 80,
      difficulty: 'hard',
      topic: 'Authentication & Cryptography',
      questions: [
        {
          text: 'Why does bcrypt remain superior to fast hashing algorithms like MD5 or SHA-256 for storing user passwords?',
          points: 2,
          explanation: 'Bcrypt is intentionally computationally expensive and CPU/memory bound, using key stretching with variable rounds to thwart massive GPU dictionary attacks.',
          options: [
            { text: 'Bcrypt includes an adaptable work factor (cost) that makes brute-force and GPU hardware cracking intentionally slow.', correct: true },
            { text: 'Bcrypt produces shorter hash strings that consume less disk space.', correct: false },
            { text: 'Bcrypt encrypts passwords reversibly so administrators can recover lost credentials.', correct: false },
            { text: 'Bcrypt does not require a salt to prevent rainbow table attacks.', correct: false },
          ],
        },
        {
          text: 'What is the critical security vulnerability when storing sensitive JWT tokens in browser localStorage instead of HttpOnly cookies?',
          points: 2,
          explanation: 'LocalStorage is directly accessible to JavaScript running on the page. If malicious script injects via XSS, it can read the token immediately.',
          options: [
            { text: 'Any Cross-Site Scripting (XSS) vulnerability allows malicious scripts to extract the token directly via window.localStorage.', correct: true },
            { text: 'Local storage is automatically deleted every time the user closes their browser window.', correct: false },
            { text: 'Browsers send localStorage contents in cleartext over HTTPS connections.', correct: false },
            { text: 'LocalStorage cannot store strings longer than 256 characters.', correct: false },
          ],
        },
      ],
    },
    {
      categorySlug: 'algorithms-data-structures',
      title: 'Binary Search Trees, Heaps & Priority Queues',
      slug: 'trees-heaps-binary-search',
      description: 'Rigorous assessment of Binary Search Tree properties, min/max heap invariant operations, AVL/Red-Black self-balancing, and priority queue implementations.',
      timeLimit: 360,
      passPercentage: 70,
      difficulty: 'medium',
      topic: 'Trees & Binary Search',
      questions: [
        {
          text: 'In what order does an in-order depth-first traversal visit the nodes of a valid Binary Search Tree (BST)?',
          points: 2,
          explanation: 'An in-order traversal (Left child, Current node, Right child) of a BST always yields the keys in non-decreasing sorted order.',
          options: [
            { text: 'Strictly monotonically ascending sorted order.', correct: true },
            { text: 'Descending order from root down to deepest leaves.', correct: false },
            { text: 'Breadth-first level-by-level order.', correct: false },
            { text: 'Random order depending on memory heap addresses.', correct: false },
          ],
        },
        {
          text: 'What is the worst-case time complexity of inserting an element into an unbalanced Binary Search Tree versus a Self-Balancing Red-Black Tree?',
          points: 2,
          explanation: 'If elements are inserted in sorted order into a naive BST, it degrades to a linear linked list with O(n) search and insert. Self-balancing trees guarantee O(log n).',
          options: [
            { text: 'O(n) for unbalanced BST when degenerate into a linked list, vs guaranteed O(log n) for Red-Black tree.', correct: true },
            { text: 'O(1) for unbalanced BST vs O(n) for Red-Black tree.', correct: false },
            { text: 'O(n log n) for both tree types.', correct: false },
            { text: 'O(log n) for unbalanced vs O(n^2) for Red-Black tree.', correct: false },
          ],
        },
      ],
    },
    {
      categorySlug: 'algorithms-data-structures',
      title: 'Graph Traversal & Computational Complexity',
      slug: 'graphs-complexity-algorithms',
      description: 'Analyze Breadth-First Search (BFS), Depth-First Search (DFS), Dijkstra shortest path with priority queues, cycle detection, and Big-O asymptotic notation.',
      timeLimit: 420,
      passPercentage: 75,
      difficulty: 'hard',
      topic: 'Graphs & Big-O Complexity',
      questions: [
        {
          text: 'Which graph traversal algorithm guarantees finding the shortest path (minimum number of edges) in an unweighted directed or undirected graph?',
          points: 2,
          explanation: 'BFS explores nodes in increasing order of distance (layer by layer), ensuring the first time a destination node is visited, it is reached via the shortest path.',
          options: [
            { text: 'Breadth-First Search (BFS) using a FIFO queue.', correct: true },
            { text: 'Depth-First Search (DFS) using recursion or a LIFO stack.', correct: false },
            { text: 'Post-order topological sort.', correct: false },
            { text: 'Prim\'s Minimum Spanning Tree algorithm.', correct: false },
          ],
        },
        {
          text: 'What is the time complexity of Dijkstra\'s algorithm for single-source shortest path using a Min-Heap (Priority Queue) with V vertices and E edges?',
          points: 2,
          explanation: 'Extracting min vertices takes O(V log V) and updating edge decrease-key operations takes O(E log V), giving O((V + E) log V).',
          options: [
            { text: 'O((V + E) log V)', correct: true },
            { text: 'O(V^3)', correct: false },
            { text: 'O(E * V)', correct: false },
            { text: 'O(V log E)', correct: false },
          ],
        },
      ],
    },
  ];

  for (const qData of additionalQuizzes) {
    const categoryId = catMap.get(qData.categorySlug);
    if (!categoryId) continue;

    const existing = await get<{ id: number }>('SELECT id FROM quizzes WHERE slug = ?;', [qData.slug]);
    if (existing) continue;

    const qRes = await run(
      `INSERT INTO quizzes (
        category_id, title, slug, description, time_limit_seconds,
        pass_percentage, difficulty, is_published, topic
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        categoryId,
        qData.title,
        qData.slug,
        qData.description,
        qData.timeLimit,
        qData.passPercentage,
        qData.difficulty,
        1,
        qData.topic,
      ]
    );

    const quizId = qRes.lastInsertRowid;
    for (let i = 0; i < qData.questions.length; i++) {
      const q = qData.questions[i];
      const quRes = await run(
        'INSERT INTO questions (quiz_id, question_text, explanation, points, sort_order) VALUES (?, ?, ?, ?, ?);',
        [quizId, q.text, q.explanation, q.points, i + 1]
      );
      const questionId = quRes.lastInsertRowid;
      for (let j = 0; j < q.options.length; j++) {
        const opt = q.options[j];
        await run(
          'INSERT INTO question_options (question_id, option_text, is_correct, sort_order) VALUES (?, ?, ?, ?);',
          [questionId, opt.text, opt.correct ? 1 : 0, j + 1]
        );
      }
    }
  }
}

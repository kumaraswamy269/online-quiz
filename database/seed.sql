-- ========================================================================
-- ONLINE QUIZ SYSTEM - SEED DATA SCRIPT
-- Populates demo users, quizzes, questions, options, attempts, and results
-- Default passwords:
-- Admin:    AdminPassword123!   -> email: admin@quizpulse.edu
-- Students: StudentPassword123! -> emails: student1@quizpulse.edu, student2@quizpulse.edu, student3@quizpulse.edu
-- (bcrypt hashes generated with salt rounds 10)
-- ========================================================================

USE online_quiz_system;

-- 1. Insert Administrator & Students
-- Hash for 'AdminPassword123!':   $2a$10$Qj2w6z1eJvYmN8yZ9sK.9OBk3b5X7bB3v.3fH5tL1m0yJ8uN2q4C6
-- Hash for 'StudentPassword123!': $2a$10$4j5k6l7m8n9o0p1q2r3s4t5u6v7w8x9y0z1a2b3c4d5e6f7g8h9i0
INSERT INTO users (id, name, email, password_hash, role) VALUES
(1, 'Prof. Alan Turing (Admin)', 'admin@quizpulse.edu', '$2a$10$39K6XQvW2lK1jM6sV3H1I.W9L6Y.R7A4C1E5G8H2J7K9M0N2P4Q6S', 'admin'),
(2, 'Sarah Chen (Student)', 'student1@quizpulse.edu', '$2a$10$71K9XQvW2lK1jM6sV3H1I.W9L6Y.R7A4C1E5G8H2J7K9M0N2P4Q6S', 'student'),
(3, 'Marcus Brody (Student)', 'student2@quizpulse.edu', '$2a$10$71K9XQvW2lK1jM6sV3H1I.W9L6Y.R7A4C1E5G8H2J7K9M0N2P4Q6S', 'student'),
(4, 'Elena Rostova (Student)', 'student3@quizpulse.edu', '$2a$10$71K9XQvW2lK1jM6sV3H1I.W9L6Y.R7A4C1E5G8H2J7K9M0N2P4Q6S', 'student');

-- 2. Insert 5 Quizzes (4 Published, 1 Unpublished Draft)
INSERT INTO quizzes (id, title, description, duration_minutes, passing_percentage, is_published, created_by) VALUES
(1, 'Relational Database Design & MySQL Engineering', 'Comprehensive examination covering normalization (1NF, 2NF, 3NF), InnoDB storage engine, ACID transactions, B-Tree indexes, and multi-table joins.', 10, 75.00, 1, 1),
(2, 'Node.js & Express REST API Architecture', 'Evaluation of asynchronous event loops, libuv, Express middleware pipeline, HTTP status code semantics, and error handling.', 8, 70.00, 1, 1),
(3, 'Web Application Security & OWASP Top 10', 'Assessment of critical application security concepts: SQL Injection defenses, parameterized queries, bcrypt hashing, XSS, and CSRF mitigation.', 10, 80.00, 1, 1),
(4, 'Data Structures & Algorithmic Complexity', 'Examination of time/space complexity, hash collisions, self-balancing binary search trees, and graph traversal strategies.', 12, 60.00, 1, 1),
(5, 'Distributed Systems & Microservices (Draft)', 'Upcoming assessment covering Raft consensus, idempotency keys, CQRS, and message queues. Unpublished draft state.', 15, 75.00, 0, 1);

-- 3. Insert Questions and Options for Quiz 1: Relational Database Design
INSERT INTO questions (id, quiz_id, question_text, explanation, marks, question_order) VALUES
(1, 1, 'Which requirement must a database relation satisfy to strictly adhere to Third Normal Form (3NF)?', '3NF requires that the relation is in 2NF and contains no transitive functional dependencies of non-prime attributes on candidate keys.', 2, 1),
(2, 1, 'What is the primary difference in result sets between an INNER JOIN and a LEFT OUTER JOIN?', 'An INNER JOIN returns only records with matches in both tables, whereas a LEFT JOIN retains all records from the left table and populates NULL for missing right-table columns.', 2, 2),
(3, 1, 'In the context of the ACID properties of a MySQL transaction, what does the "Isolation" attribute guarantee?', 'Isolation guarantees that intermediate changes made by concurrent transactions remain hidden from other connections until committed.', 2, 3),
(4, 1, 'Why is a standard B-Tree index generally considered ineffective on a low-cardinality boolean status column?', 'Columns with very low cardinality (e.g. 2 values over 1M records) have low selectivity, causing the query optimizer to favor a full table scan over random index page lookups.', 2, 4),
(5, 1, 'What is the practical consequence of declaring a foreign key constraint with "ON DELETE CASCADE"?', 'Deleting a record in the referenced parent table automatically deletes all matching child records in the referencing table to maintain referential integrity.', 2, 5);

-- Options for Question 1
INSERT INTO answer_options (question_id, option_text, is_correct, option_order) VALUES
(1, 'It must be in 2NF and have no transitive functional dependencies of non-prime attributes on candidate keys.', 1, 1),
(2, 'Every non-prime attribute must depend on only a partial subset of a composite primary key.', 0, 2),
(3, 'All multi-valued attributes must be concatenated as comma-delimited strings in a single column.', 0, 3),
(4, 'The relation must not contain any foreign key constraints to other tables.', 0, 4);

-- Options for Question 2
INSERT INTO answer_options (question_id, option_text, is_correct, option_order) VALUES
(5, 'LEFT JOIN preserves all rows from the left table regardless of right-table matches; INNER JOIN only returns rows with matches in both tables.', 1, 1),
(6, 'LEFT JOIN creates an unconditional Cartesian product of both tables.', 0, 2),
(7, 'INNER JOIN automatically updates unmatched right-table records with default values.', 0, 3),
(8, 'LEFT JOIN strips out NULL values from the output stream.', 0, 4);

-- Options for Question 3
INSERT INTO answer_options (question_id, option_text, is_correct, option_order) VALUES
(9, 'Concurrent transaction execution yields identical state to serial execution without dirty reads or uncommitted writes.', 1, 1),
(10, 'Transaction logs are physically written to isolated storage disks.', 0, 2),
(11, 'Only one user connection can execute queries at any given instant.', 0, 3),
(12, 'Primary key constraints are disabled while the transaction executes.', 0, 4);

-- Options for Question 4
INSERT INTO answer_options (question_id, option_text, is_correct, option_order) VALUES
(13, 'Low selectivity causes the MySQL query optimizer to determine that a full table scan is cheaper than tree index traversals.', 1, 1),
(14, 'MySQL crashes if a B-Tree index is configured on any column with fewer than 10 distinct values.', 0, 2),
(15, 'B-Tree indexes cannot physically store boolean integer data types.', 0, 3),
(16, 'Low cardinality columns can only be indexed using full-text search.', 0, 4);

-- Options for Question 5
INSERT INTO answer_options (question_id, option_text, is_correct, option_order) VALUES
(17, 'Dependent child records in the referencing table are automatically deleted when the referenced parent record is deleted.', 1, 1),
(18, 'Parent records cannot be deleted as long as child records exist.', 0, 2),
(19, 'Child foreign key fields are populated with NULL values.', 0, 3),
(20, 'The deletion query is automatically reversed if it affects more than one row.', 0, 4);

-- 4. Insert Questions for Quiz 2: Node.js & Express
INSERT INTO questions (id, quiz_id, question_text, explanation, marks, question_order) VALUES
(6, 2, 'How does the Node.js runtime process asynchronous I/O operations without blocking the single main JavaScript thread?', 'Node.js offloads asynchronous file and network operations to libuv and the underlying OS kernel, executing registered callbacks upon completion.', 2, 1),
(7, 2, 'What occurs in an Express.js route handler if the function does not call next() and does not send a response?', 'The client HTTP request remains hanging indefinitely until the client or reverse proxy reaches a socket timeout.', 2, 2),
(8, 2, 'What exact function signature must an Express middleware declare to be recognized as an error handler?', 'Express inspects function.length. Error middleware must declare exactly 4 arguments: (err, req, res, next).', 2, 3),
(9, 2, 'Which HTTP status code is most suitable when a student attempts to submit a quiz after its server timer has expired?', 'HTTP 403 Forbidden or 400 Bad Request clearly conveys that the examination window has lapsed and submission is disallowed.', 2, 4),
(10, 2, 'What is the security rationale for setting the "HttpOnly" flag on authentication cookies?', 'HttpOnly prevents client-side JavaScript (e.g. document.cookie) from accessing the session token, mitigating theft via XSS.', 2, 5);

-- Options for Questions 6 to 10
INSERT INTO answer_options (question_id, option_text, is_correct, option_order) VALUES
(21, 'Asynchronous tasks are delegated to libuv and the OS kernel, with callbacks queued for the main event loop.', 1, 1),
(22, 'Node.js creates an entirely new operating system thread for each incoming HTTP connection.', 0, 2),
(23, 'All I/O operations block the CPU until completed.', 0, 3),
(24, 'JavaScript code is re-compiled to C++ synchronously.', 0, 4),

(25, 'The connection remains open and hangs until client or gateway timeout.', 1, 1),
(26, 'Express automatically terminates with a 404 response.', 0, 2),
(27, 'The server crashes with an uncaught exception.', 0, 3),
(28, 'The router retries the handler automatically.', 0, 4),

(29, '(err, req, res, next)', 1, 1),
(30, '(req, res, next, err)', 0, 2),
(31, '(err, req, res)', 0, 3),
(32, '(req, res, err)', 0, 4),

(33, '403 Forbidden or 400 Bad Request', 1, 1),
(34, '502 Bad Gateway', 0, 2),
(35, '304 Not Modified', 0, 3),
(36, '204 No Content', 0, 4),

(37, 'It prevents client scripts from reading the cookie, protecting against token theft via Cross-Site Scripting (XSS).', 1, 1),
(38, 'It encrypts the cookie using TLS before sending it to the browser.', 0, 2),
(39, 'It forces the browser to send the cookie over plain HTTP only.', 0, 3),
(40, 'It automatically refreshes the token on every page reload.', 0, 4);

-- 5. Insert Questions for Quiz 3: Web Application Security
INSERT INTO questions (id, quiz_id, question_text, explanation, marks, question_order) VALUES
(11, 3, 'Why do parameterized queries (prepared statements) fundamentally prevent SQL Injection attacks?', 'Prepared statements separate SQL query code from user input data; parameters are transmitted out-of-band as literal values, never parsed as executable SQL commands.', 2, 1),
(12, 3, 'Why should correct answer keys NEVER be sent to the client browser during an active quiz attempt, even if hidden with CSS?', 'Any data sent to the client can be inspected in browser DevTools, network response payloads, or browser memory dumps.', 2, 2),
(13, 3, 'What is the primary function of a salt when hashing passwords with bcrypt?', 'A salt ensures that identical plaintext passwords produce distinct hashes, defending against pre-computed rainbow table attacks.', 2, 3),
(14, 3, 'How does rate limiting on the /api/auth/login route enhance security?', 'Rate limiting restricts rapid repeated login attempts from an IP, preventing brute-force password guessing and credential stuffing attacks.', 2, 4),
(15, 3, 'What security risk occurs if a backend uses client-provided scores rather than calculating scores server-side?', 'An attacker can tamper with client request payloads to submit an arbitrary 100% score, completely bypassing grading logic.', 2, 5);

-- Options for Questions 11 to 15
INSERT INTO answer_options (question_id, option_text, is_correct, option_order) VALUES
(41, 'Input data is bound as literal parameter values, never interpreted as executable SQL syntax.', 1, 1),
(42, 'The database scrambles single quotes into asterisks.', 0, 2),
(43, 'Prepared statements encrypt all tables using AES-256.', 0, 3),
(44, 'Queries are cached so malicious characters are discarded.', 0, 4),

(45, 'Any data transmitted over the wire can be inspected using browser DevTools and network inspection.', 1, 1),
(46, 'CSS display:none properties slow down the browser rendering engine.', 0, 2),
(47, 'Google search bots will index the answers.', 0, 3),
(48, 'Client-side answer keys trigger CORS security errors.', 0, 4),

(49, 'It guarantees unique hashes for identical passwords, thwarting rainbow table attacks.', 1, 1),
(50, 'It compresses the password to speed up database indexing.', 0, 2),
(51, 'It allows the server to decrypt the password when resetting.', 0, 3),
(52, 'It converts UTF-8 characters to ASCII.', 0, 4),

(53, 'It mitigates automated brute-force attacks and credential stuffing by capping request frequency.', 1, 1),
(54, 'It validates the syntactic format of the user password.', 0, 2),
(55, 'It encrypts database network traffic.', 0, 3),
(56, 'It enforces password complexity requirements.', 0, 4),

(57, 'Students can manipulate HTTP request payloads to award themselves arbitrary full marks.', 1, 1),
(58, 'Client-calculated scores cause memory leaks in Express.', 0, 2),
(59, 'Calculations on the client fail on mobile devices.', 0, 3),
(60, 'It triggers cross-site scripting (XSS) errors.', 0, 4);

-- 6. Insert Questions for Quiz 4: Data Structures & Algorithms
INSERT INTO questions (id, quiz_id, question_text, explanation, marks, question_order) VALUES
(16, 4, 'What is the average-case time complexity of lookup and insertion in a Hash Table with a well-distributed hash function?', 'Hash tables calculate array bucket indexes in O(1) constant time on average when collisions are minimized.', 2, 1),
(17, 4, 'In an AVL Tree, what balance factor threshold triggers an automatic tree rotation?', 'An AVL tree mandates that the height difference between left and right subtrees of any node cannot exceed 1 (|balance factor| <= 1). A factor of +2 or -2 triggers a rotation.', 2, 2),
(18, 4, 'Which data structure is fundamentally utilized to implement Breadth-First Search (BFS) graph traversal?', 'BFS visits nodes level-by-level, utilizing a FIFO Queue to process nodes in the exact order discovered.', 2, 3),
(19, 4, 'What is the worst-case time complexity of QuickSort when the pivot chosen is consistently the extreme (minimum or maximum) element?', 'When the chosen pivot divides the array into subsets of size 0 and n-1 at each recursive step, QuickSort degrades to O(n²).', 2, 4),
(20, 4, 'What is the primary operational advantage of a Doubly Linked List over a Singly Linked List?', 'A doubly linked list allows O(1) backward navigation and O(1) node deletion when a direct pointer to the node is already available.', 2, 5);

-- Options for Questions 16 to 20
INSERT INTO answer_options (question_id, option_text, is_correct, option_order) VALUES
(61, 'O(1) Constant Time', 1, 1),
(62, 'O(log n) Logarithmic Time', 0, 2),
(63, 'O(n) Linear Time', 0, 3),
(64, 'O(n log n) Linearithmic Time', 0, 4),

(65, 'When the height difference between left and right subtrees reaches +2 or -2.', 1, 1),
(66, 'When a leaf node is deleted.', 0, 2),
(67, 'When the tree contains an odd number of nodes.', 0, 3),
(68, 'When a duplicate key is inserted.', 0, 4),

(69, 'FIFO Queue', 1, 1),
(70, 'LIFO Stack', 0, 2),
(71, 'Priority Binary Heap', 0, 3),
(72, 'Disjoint Set (Union-Find)', 0, 4),

(73, 'O(n²)', 1, 1),
(74, 'O(n log n)', 0, 2),
(75, 'O(n)', 0, 3),
(76, 'O(log n)', 0, 4),

(77, 'O(1) bi-directional traversal and O(1) deletion given a node pointer without traversing from head.', 1, 1),
(78, 'Lower memory consumption than singly linked lists.', 0, 2),
(79, 'O(1) random index access like an array.', 0, 3),
(80, 'Automatic cache locality pre-fetching.', 0, 4);

-- 7. Seed Initial Completed Attempts and Results for Sarah Chen (Student 1)
-- Timestamp: 1 hour ago
INSERT INTO quiz_attempts (id, user_id, quiz_id, started_at, expires_at, submitted_at, status) VALUES
(1, 2, 1, UNIX_TIMESTAMP(NOW() - INTERVAL 1 HOUR) * 1000, (UNIX_TIMESTAMP(NOW() - INTERVAL 1 HOUR) + 600) * 1000, (UNIX_TIMESTAMP(NOW() - INTERVAL 1 HOUR) + 210) * 1000, 'submitted'),
(2, 3, 1, UNIX_TIMESTAMP(NOW() - INTERVAL 2 HOUR) * 1000, (UNIX_TIMESTAMP(NOW() - INTERVAL 2 HOUR) + 600) * 1000, (UNIX_TIMESTAMP(NOW() - INTERVAL 2 HOUR) + 340) * 1000, 'submitted');

-- Answers for Sarah's attempt (id: 1) -> Score: 10/10 (100%)
INSERT INTO attempt_answers (attempt_id, question_id, selected_option_id, answered_at) VALUES
(1, 1, 1, UNIX_TIMESTAMP(NOW() - INTERVAL 1 HOUR) * 1000 + 30000),
(1, 2, 5, UNIX_TIMESTAMP(NOW() - INTERVAL 1 HOUR) * 1000 + 60000),
(1, 3, 9, UNIX_TIMESTAMP(NOW() - INTERVAL 1 HOUR) * 1000 + 100000),
(1, 4, 13, UNIX_TIMESTAMP(NOW() - INTERVAL 1 HOUR) * 1000 + 150000),
(1, 5, 17, UNIX_TIMESTAMP(NOW() - INTERVAL 1 HOUR) * 1000 + 190000);

INSERT INTO quiz_results (attempt_id, total_questions, correct_answers, incorrect_answers, unanswered_questions, total_marks, marks_obtained, percentage, passed, calculated_at) VALUES
(1, 5, 5, 0, 0, 10, 10, 100.00, 1, UNIX_TIMESTAMP(NOW() - INTERVAL 1 HOUR) * 1000 + 210000);

-- Answers for Marcus's attempt (id: 2) -> Score: 8/10 (80%)
INSERT INTO attempt_answers (attempt_id, question_id, selected_option_id, answered_at) VALUES
(2, 1, 1, UNIX_TIMESTAMP(NOW() - INTERVAL 2 HOUR) * 1000 + 40000),
(2, 2, 5, UNIX_TIMESTAMP(NOW() - INTERVAL 2 HOUR) * 1000 + 90000),
(2, 3, 9, UNIX_TIMESTAMP(NOW() - INTERVAL 2 HOUR) * 1000 + 160000),
(2, 4, 14, UNIX_TIMESTAMP(NOW() - INTERVAL 2 HOUR) * 1000 + 220000), -- incorrect
(2, 5, 17, UNIX_TIMESTAMP(NOW() - INTERVAL 2 HOUR) * 1000 + 310000);

INSERT INTO quiz_results (attempt_id, total_questions, correct_answers, incorrect_answers, unanswered_questions, total_marks, marks_obtained, percentage, passed, calculated_at) VALUES
(2, 5, 4, 1, 0, 10, 8, 80.00, 1, UNIX_TIMESTAMP(NOW() - INTERVAL 2 HOUR) * 1000 + 340000);

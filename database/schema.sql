-- MySQL 8.0+. Run inside the database selected by DB_NAME.
-- Additive initialization only: no DROP, TRUNCATE or destructive migration.
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student','admin') NOT NULL DEFAULT 'student',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS questions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  content TEXT NOT NULL,
  option_a VARCHAR(1000) NOT NULL,
  option_b VARCHAR(1000) NOT NULL,
  option_c VARCHAR(1000) NOT NULL,
  option_d VARCHAR(1000) NOT NULL,
  correct_option ENUM('A','B','C','D') NOT NULL,
  explanation TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  deleted_at DATETIME(3) NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_questions_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exams (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  question_count SMALLINT UNSIGNED NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at DATETIME(3) NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (created_by) REFERENCES users(id),
  CHECK (duration_minutes BETWEEN 1 AND 180),
  CHECK (question_count BETWEEN 1 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exam_questions (
  exam_id INT UNSIGNED NOT NULL,
  question_id INT UNSIGNED NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (exam_id, question_id),
  UNIQUE KEY uq_exam_position (exam_id, position),
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attempts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  exam_id INT UNSIGNED NOT NULL,
  exam_title VARCHAR(200) NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  total_questions SMALLINT UNSIGNED NOT NULL,
  status ENUM('in_progress','submitted','expired') NOT NULL DEFAULT 'in_progress',
  started_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  submitted_at DATETIME(3) NULL,
  correct_count SMALLINT UNSIGNED NULL,
  score DECIMAL(4,2) NULL,
  active_slot TINYINT GENERATED ALWAYS AS (CASE WHEN status = 'in_progress' THEN 1 ELSE NULL END) STORED,
  UNIQUE KEY uq_active_attempt (user_id, exam_id, active_slot),
  INDEX idx_attempt_expiry (status, expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (exam_id) REFERENCES exams(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS answers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attempt_id INT UNSIGNED NOT NULL,
  question_id INT UNSIGNED NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  question_content TEXT NOT NULL,
  option_a VARCHAR(1000) NOT NULL,
  option_b VARCHAR(1000) NOT NULL,
  option_c VARCHAR(1000) NOT NULL,
  option_d VARCHAR(1000) NOT NULL,
  correct_option ENUM('A','B','C','D') NOT NULL,
  explanation TEXT NOT NULL,
  selected_option ENUM('A','B','C','D') NULL,
  is_correct BOOLEAN NULL,
  UNIQUE KEY uq_attempt_question (attempt_id, question_id),
  UNIQUE KEY uq_attempt_position (attempt_id, position),
  FOREIGN KEY (attempt_id) REFERENCES attempts(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Persist express-session across application restarts.
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR(128) PRIMARY KEY,
  data MEDIUMTEXT NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  INDEX idx_sessions_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

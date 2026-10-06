CREATE TABLE IF NOT EXISTS cities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_cities_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS barangays (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  city_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(12) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_barangays_code (code),
  UNIQUE KEY uq_barangays_slug (slug),
  UNIQUE KEY uq_barangays_id_city (id, city_id),
  CONSTRAINT fk_barangays_city FOREIGN KEY (city_id) REFERENCES cities (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  barangay_id BIGINT UNSIGNED NOT NULL,
  username VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  KEY ix_users_barangay (barangay_id),
  CONSTRAINT fk_users_barangay FOREIGN KEY (barangay_id) REFERENCES barangays (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  data MEDIUMTEXT NOT NULL,
  PRIMARY KEY (session_id),
  KEY ix_sessions_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS case_sequences (
  barangay_id BIGINT UNSIGNED NOT NULL,
  intake_year SMALLINT UNSIGNED NOT NULL,
  sequence_value INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (barangay_id, intake_year),
  CONSTRAINT fk_case_sequences_barangay FOREIGN KEY (barangay_id) REFERENCES barangays (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS blotters (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_id VARCHAR(48) NOT NULL,
  barangay_id BIGINT UNSIGNED NOT NULL,
  city_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  incident_type VARCHAR(40) NOT NULL,
  incident_datetime DATETIME(3) NOT NULL,
  sitio VARCHAR(120) NOT NULL,
  landmark VARCHAR(255) NULL,
  complainant_name VARCHAR(160) NOT NULL,
  complainant_contact VARCHAR(20) NULL,
  complainant_sitio VARCHAR(120) NULL,
  complainant_resident_status VARCHAR(20) NOT NULL,
  respondent_unknown TINYINT(1) NOT NULL,
  respondent_name VARCHAR(160) NULL,
  respondent_contact VARCHAR(20) NULL,
  respondent_sitio VARCHAR(120) NULL,
  respondent_resident_status VARCHAR(20) NOT NULL,
  narrative TEXT NOT NULL,
  status VARCHAR(24) NOT NULL,
  source VARCHAR(24) NOT NULL DEFAULT 'walk_in',
  resident_report_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL,
  submitted_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_blotters_case_id (case_id),
  UNIQUE KEY uq_blotters_source_report (resident_report_id),
  KEY ix_blotters_tenant_created (barangay_id, created_at, id),
  KEY ix_blotters_tenant_submitted (barangay_id, submitted_at, id),
  KEY ix_blotters_tenant_status (barangay_id, status, submitted_at),
  KEY ix_blotters_tenant_datetime (barangay_id, incident_datetime),
  KEY ix_blotters_tenant_sitio (barangay_id, sitio),
  CONSTRAINT fk_blotters_barangay_city FOREIGN KEY (barangay_id, city_id) REFERENCES barangays (id, city_id),
  CONSTRAINT fk_blotters_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS case_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  blotter_id BIGINT UNSIGNED NOT NULL,
  barangay_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(24) NULL,
  to_status VARCHAR(24) NULL,
  reason VARCHAR(1000) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_case_events_blotter (barangay_id, blotter_id, id),
  CONSTRAINT fk_case_events_blotter FOREIGN KEY (blotter_id) REFERENCES blotters (id),
  CONSTRAINT fk_case_events_barangay FOREIGN KEY (barangay_id) REFERENCES barangays (id),
  CONSTRAINT fk_case_events_actor FOREIGN KEY (actor_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS resident_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference VARCHAR(64) NOT NULL,
  barangay_id BIGINT UNSIGNED NOT NULL,
  city_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending_review',
  reporter_name VARCHAR(160) NOT NULL,
  reporter_contact VARCHAR(20) NULL,
  incident_type VARCHAR(40) NOT NULL,
  incident_datetime DATETIME(3) NOT NULL,
  sitio VARCHAR(120) NOT NULL,
  landmark VARCHAR(255) NULL,
  respondent_name VARCHAR(160) NULL,
  narrative TEXT NOT NULL,
  submitted_at DATETIME(3) NOT NULL,
  reviewed_at DATETIME(3) NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  rejection_reason VARCHAR(1000) NULL,
  blotter_id BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_resident_reports_reference (reference),
  UNIQUE KEY uq_resident_reports_blotter (blotter_id),
  KEY ix_resident_reports_queue (barangay_id, status, submitted_at, id),
  KEY ix_resident_reports_city (barangay_id, city_id),
  CONSTRAINT fk_resident_reports_barangay_city FOREIGN KEY (barangay_id, city_id) REFERENCES barangays (id, city_id),
  CONSTRAINT fk_resident_reports_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id),
  CONSTRAINT fk_resident_reports_blotter FOREIGN KEY (blotter_id) REFERENCES blotters (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

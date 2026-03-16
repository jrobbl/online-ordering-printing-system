-- ============================================================
-- init.sql
-- Hello Printer — Database Initialization
-- ============================================================

CREATE TABLE IF NOT EXISTS print_jobs (
    id          SERIAL PRIMARY KEY,
    status      VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending', 'done')),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    printed_at  TIMESTAMP DEFAULT NULL
);

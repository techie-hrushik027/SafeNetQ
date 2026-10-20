USE safenetq_db;

-- Run once against an existing v4 database before starting the updated bridge.
ALTER TABLE fault_logs
    ADD COLUMN rms_current_amps FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN score FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN cusum FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN cf FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN edge FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN jitter FLOAT NOT NULL DEFAULT 0;

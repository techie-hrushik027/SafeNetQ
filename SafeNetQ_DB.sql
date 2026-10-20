CREATE DATABASE IF NOT EXISTS safenetq_db;
USE safenetq_db;

CREATE TABLE IF NOT EXISTS fault_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    fault_type VARCHAR(50) NOT NULL,
    -- Legacy columns remain populated for existing dashboard/history consumers.
    peak_current_amps FLOAT NOT NULL DEFAULT 0,
    crest_factor FLOAT NOT NULL DEFAULT 0,
    di_dt FLOAT NOT NULL DEFAULT 0,
    action_taken VARCHAR(50) NOT NULL,
    rms_current_amps FLOAT NOT NULL DEFAULT 0,
    score FLOAT NOT NULL DEFAULT 0,
    cusum FLOAT NOT NULL DEFAULT 0,
    cf FLOAT NOT NULL DEFAULT 0,
    edge FLOAT NOT NULL DEFAULT 0,
    jitter FLOAT NOT NULL DEFAULT 0
);

SELECT * FROM fault_logs;

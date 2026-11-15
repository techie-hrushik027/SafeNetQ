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
    jitter FLOAT NOT NULL DEFAULT 0,
    asymmetry FLOAT NOT NULL DEFAULT 0,
    width FLOAT NOT NULL DEFAULT 0,
    roughness FLOAT NOT NULL DEFAULT 0,
    shape_shift FLOAT NOT NULL DEFAULT 0,
    peak_cv FLOAT NOT NULL DEFAULT 0,
    width_cv FLOAT NOT NULL DEFAULT 0,
    hit_count INT NOT NULL DEFAULT 0,
    detector_state VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    dc_offset_mv FLOAT NOT NULL DEFAULT 0,
    lobe_depth_mv FLOAT NOT NULL DEFAULT 0,
    win_rate_hz FLOAT NOT NULL DEFAULT 0,
    trip_reason VARCHAR(50) NOT NULL DEFAULT 'NONE'
);

SELECT * FROM fault_logs;

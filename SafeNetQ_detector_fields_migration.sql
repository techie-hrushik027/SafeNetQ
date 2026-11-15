-- Apply once to an existing SafeNetQ database before the expanded detector
-- feature fields are written by the bridge.
USE safenetq_db;

ALTER TABLE fault_logs
    ADD COLUMN asymmetry FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN width FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN roughness FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN shape_shift FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN peak_cv FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN width_cv FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN hit_count INT NOT NULL DEFAULT 0,
    ADD COLUMN detector_state VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN dc_offset_mv FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN lobe_depth_mv FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN win_rate_hz FLOAT NOT NULL DEFAULT 0,
    ADD COLUMN trip_reason VARCHAR(50) NOT NULL DEFAULT 'NONE';

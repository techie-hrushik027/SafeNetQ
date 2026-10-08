CREATE DATABASE safenetq_db;
USE safenetq_db;

CREATE TABLE fault_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    fault_type VARCHAR(50) NOT NULL,
    peak_current_amps FLOAT NOT NULL,
    crest_factor FLOAT NOT NULL,
    di_dt FLOAT NOT NULL,
    action_taken VARCHAR(50) NOT NULL
);

select * from fault_logs;
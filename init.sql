-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS asset_deliveries (
    id SERIAL PRIMARY KEY,
    employee_name VARCHAR(30) NOT NULL,
    employee_id VARCHAR(7) NOT NULL,
    department VARCHAR(50) NOT NULL,
    assets JSONB NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asset_requests (
    id SERIAL PRIMARY KEY,
    employee_name VARCHAR(30) NOT NULL,
    employee_id VARCHAR(7) NOT NULL,
    asset_name VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assigned_assets (
    id SERIAL PRIMARY KEY,
    employee_name VARCHAR(30) NOT NULL,
    employee_id VARCHAR(7) NOT NULL,
    asset_name VARCHAR(100) NOT NULL,
    assigned_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS rejected_requests (
    id SERIAL PRIMARY KEY,
    employee_name VARCHAR(30) NOT NULL,
    employee_id VARCHAR(7) NOT NULL,
    asset_name VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    rejected_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL
);

-- Insert sample data
INSERT INTO asset_deliveries (employee_name, employee_id, department, assets)
VALUES ('Veera', 'ATS0001', 'IT', '["Laptop", "Monitor"]')
ON CONFLICT DO NOTHING;

INSERT INTO asset_requests (employee_name, employee_id, asset_name, reason)
VALUES ('Veera', 'ATS0001', 'Laptop', 'Need for development work')
ON CONFLICT DO NOTHING;

INSERT INTO assigned_assets (employee_name, employee_id, asset_name, assigned_date, status)
VALUES ('Veera', 'ATS0001', 'MacBook Pro', '2024-10-15', 'Assigned')
ON CONFLICT DO NOTHING;

INSERT INTO rejected_requests (employee_name, employee_id, asset_name, reason, rejected_date, status)
VALUES ('Raghava', 'ATS0002', 'Monitor', 'Not needed', '2024-10-15', 'Rejected')
ON CONFLICT DO NOTHING;
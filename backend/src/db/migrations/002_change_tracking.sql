-- Migration 002: Add Change Tracking

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    user_id UUID REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT NOW()
);

-- Create index for fast queries
CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX idx_audit_log_record_id ON audit_log(record_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_changed_at ON audit_log(changed_at DESC);

-- Function to log changes
CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_log (table_name, record_id, action, old_data)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_log (table_name, record_id, action, old_data, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_log (table_name, record_id, action, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to important tables
CREATE TRIGGER recordings_audit
    AFTER INSERT OR UPDATE OR DELETE ON recordings
    FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER ai_jobs_audit
    AFTER INSERT OR UPDATE OR DELETE ON ai_jobs
    FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER credit_transactions_audit
    AFTER INSERT OR UPDATE OR DELETE ON credit_transactions
    FOR EACH ROW EXECUTE FUNCTION log_changes();

-- View recent changes
CREATE VIEW recent_changes AS
SELECT
    table_name,
    record_id,
    action,
    changed_at
FROM audit_log
ORDER BY changed_at DESC
LIMIT 100;

COMMENT ON TABLE audit_log IS 'Tracks all changes to important tables';

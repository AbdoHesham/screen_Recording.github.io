-- Migration 008: Access Control and Audit Trail
-- Creates tables for tracking feature usage, plan changes, video jobs, and audit logs

-- User Plan History Table
-- Tracks all plan changes for audit trail
CREATE TABLE IF NOT EXISTS user_plan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plans(id),
  previous_plan_id UUID REFERENCES plans(id),
  changed_by UUID REFERENCES users(id), -- admin who made the change
  change_reason TEXT,
  effective_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP INDEX IF EXISTS idx_user_plan_history_user;
DROP INDEX IF EXISTS idx_user_plan_history_date;
CREATE INDEX idx_user_plan_history_user ON user_plan_history(user_id);
CREATE INDEX idx_user_plan_history_date ON user_plan_history(effective_date DESC);

-- Feature Usage Tracking Table
-- Tracks monthly feature usage per user for quota enforcement
CREATE TABLE IF NOT EXISTS feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES features(id),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  period_start DATE NOT NULL, -- e.g., '2026-02-01' for monthly tracking
  period_end DATE NOT NULL,   -- e.g., '2026-02-28'
  metadata JSONB, -- store additional context like file size, duration, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, feature_id, period_start)
);

DROP INDEX IF EXISTS idx_feature_usage_user_period;
DROP INDEX IF EXISTS idx_feature_usage_feature;
CREATE INDEX idx_feature_usage_user_period ON feature_usage(user_id, period_start);
CREATE INDEX idx_feature_usage_feature ON feature_usage(feature_id);

-- Video Processing Jobs Table
-- Tracks background video processing jobs
CREATE TABLE IF NOT EXISTS video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  job_type VARCHAR(50) NOT NULL, -- 'export', 'preview', 'thumbnail', 'trim', 'merge'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  input_file_url TEXT,
  output_file_url TEXT,
  job_data JSONB, -- store timeline, segments, effects, etc.
  progress INTEGER DEFAULT 0, -- 0-100
  error_message TEXT,
  credits_cost INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP INDEX IF EXISTS idx_video_jobs_user_status;
DROP INDEX IF EXISTS idx_video_jobs_status;
DROP INDEX IF EXISTS idx_video_jobs_created;
CREATE INDEX idx_video_jobs_user_status ON video_jobs(user_id, status);
CREATE INDEX idx_video_jobs_status ON video_jobs(status);
CREATE INDEX idx_video_jobs_created ON video_jobs(created_at DESC);

-- Feature Audit Log Table
-- Complete audit trail for security and compliance
CREATE TABLE IF NOT EXISTS feature_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL, -- 'plan_changed', 'feature_used', 'credits_added', 'video_exported'
  resource_type VARCHAR(50), -- 'plan', 'feature', 'user', 'video_job', 'credit'
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP INDEX IF EXISTS idx_feature_audit_log_user;
DROP INDEX IF EXISTS idx_feature_audit_log_created;
DROP INDEX IF EXISTS idx_feature_audit_log_action;
DROP INDEX IF EXISTS idx_feature_audit_log_resource;
CREATE INDEX idx_feature_audit_log_user ON feature_audit_log(user_id);
CREATE INDEX idx_feature_audit_log_created ON feature_audit_log(created_at DESC);
CREATE INDEX idx_feature_audit_log_action ON feature_audit_log(action);
CREATE INDEX idx_feature_audit_log_resource ON feature_audit_log(resource_type, resource_id);

-- Add helpful comments
COMMENT ON TABLE user_plan_history IS 'Tracks all plan changes for users with full audit trail';
COMMENT ON TABLE feature_usage IS 'Monthly feature usage tracking for quota enforcement';
COMMENT ON TABLE video_jobs IS 'Background video processing job queue and status tracking';
COMMENT ON TABLE feature_audit_log IS 'Complete audit trail for all sensitive operations';

-- Grant permissions (adjust as needed based on your database user)
-- GRANT SELECT, INSERT, UPDATE ON user_plan_history TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON feature_usage TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON video_jobs TO your_app_user;
-- GRANT SELECT, INSERT ON audit_log TO your_app_user;

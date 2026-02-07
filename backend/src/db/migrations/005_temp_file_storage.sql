-- Migration: Add temporary file storage table
-- Files are uploaded here first, then moved to recordings table

CREATE TABLE IF NOT EXISTS temp_file_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key VARCHAR(500) UNIQUE NOT NULL,
  file_data BYTEA NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour')
);

-- Index for cleanup of expired files
CREATE INDEX IF NOT EXISTS idx_temp_files_expires ON temp_file_storage(expires_at);

-- Comment
COMMENT ON TABLE temp_file_storage IS 'Temporary storage for uploaded files before recording metadata is created';

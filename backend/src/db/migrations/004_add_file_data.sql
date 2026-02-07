-- Migration: Add file data storage to recordings table
-- This allows storing video files directly in the database

-- Add column to store binary video data
ALTER TABLE recordings
ADD COLUMN IF NOT EXISTS file_data BYTEA;

-- Add column to track file content type
ALTER TABLE recordings
ADD COLUMN IF NOT EXISTS file_content_type VARCHAR(100);

-- Add comment explaining the column
COMMENT ON COLUMN recordings.file_data IS 'Binary video/audio data stored directly in database';
COMMENT ON COLUMN recordings.file_content_type IS 'MIME type of the stored file (e.g., video/webm, audio/webm)';

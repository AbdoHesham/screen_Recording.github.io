-- Feature Flags System
-- Allows admin to control features and subscriptions

-- Feature flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  requires_subscription BOOLEAN DEFAULT false,
  required_role VARCHAR(50) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feature_flags_updated_at
BEFORE UPDATE ON feature_flags
FOR EACH ROW
EXECUTE FUNCTION update_feature_flags_updated_at();

-- Insert default features
INSERT INTO feature_flags (feature_name, display_name, description, enabled, requires_subscription, required_role)
VALUES
  ('recording', 'Screen Recording', 'Record screen and voice', true, false, 'free'),
  ('video_editor', 'Video Editor', 'Edit videos with timeline, trim, and effects', true, false, 'free'),
  ('ai_transcription', 'AI Transcription', 'AI-powered transcription enhancement', true, true, 'pro'),
  ('ai_filler_removal', 'Filler Word Removal', 'Remove ums, ahs, and filler words', true, true, 'pro'),
  ('ai_silence_removal', 'Silence Removal', 'Automatically remove silence', true, true, 'pro'),
  ('ai_noise_reduction', 'Noise Reduction', 'AI-powered background noise removal', true, true, 'pro'),
  ('ai_meeting_summary', 'Meeting Summarizer', 'AI meeting analysis and summaries', true, true, 'pro'),
  ('ai_tutorial_editor', 'Tutorial Editor', 'AI-powered tutorial optimization', true, true, 'pro'),
  ('cloud_storage', 'Cloud Storage', 'Store recordings in cloud', true, false, 'free'),
  ('sharing', 'Share Recordings', 'Generate shareable links', true, false, 'free'),
  ('export_formats', 'Multiple Export Formats', 'Export to MP4, MOV, GIF', true, true, 'pro'),
  ('custom_branding', 'Custom Branding', 'Add watermarks and logos', true, true, 'pro')
ON CONFLICT (feature_name) DO NOTHING;

-- Feature access log (optional - track feature usage)
CREATE TABLE IF NOT EXISTS feature_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  feature_name VARCHAR(100),
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

CREATE INDEX idx_feature_usage_user ON feature_usage_log(user_id);
CREATE INDEX idx_feature_usage_feature ON feature_usage_log(feature_name);
CREATE INDEX idx_feature_usage_date ON feature_usage_log(accessed_at);

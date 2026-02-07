-- Migration: Features and Plans System
-- Create features, plans, and plan_features tables for subscription management

-- Features table
CREATE TABLE IF NOT EXISTS features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  feature_key VARCHAR(50) NOT NULL UNIQUE, -- e.g., 'transcription', 'video_editing'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plans table
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  price_monthly DECIMAL(10, 2) DEFAULT 0,
  price_yearly DECIMAL(10, 2) DEFAULT 0,
  credits_included INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plan Features (many-to-many relationship)
CREATE TABLE IF NOT EXISTS plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  limit_value INTEGER, -- e.g., max recordings per month, max duration
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id, feature_id)
);

-- Update users table to add plan_id
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id);

-- Landing Page Content table
CREATE TABLE IF NOT EXISTS landing_page_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key VARCHAR(50) NOT NULL UNIQUE, -- e.g., 'hero_title', 'hero_subtitle'
  content_type VARCHAR(20) NOT NULL, -- 'text', 'html', 'image_url'
  content_value TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plan_features_plan ON plan_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_features_feature ON plan_features(feature_id);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan_id);

-- Insert default features
INSERT INTO features (name, description, feature_key) VALUES
  ('Screen Recording', 'Record your screen with audio', 'screen_recording'),
  ('Voice Recording', 'Record audio only', 'voice_recording'),
  ('AI Transcription', 'Automatic speech-to-text transcription', 'transcription'),
  ('Video Editing', 'Basic video editing tools', 'video_editing'),
  ('Cloud Storage', 'Store recordings in the cloud', 'cloud_storage'),
  ('HD Quality', 'Record in high definition', 'hd_quality'),
  ('Custom Branding', 'Remove watermarks and add your logo', 'custom_branding'),
  ('Team Collaboration', 'Share recordings with team members', 'team_collaboration')
ON CONFLICT (feature_key) DO NOTHING;

-- Insert default plans
INSERT INTO plans (name, description, price_monthly, price_yearly, credits_included, is_default, sort_order) VALUES
  ('Free', 'Perfect for getting started', 0, 0, 100, true, 1),
  ('Pro', 'For professionals and content creators', 9.99, 99.99, 500, false, 2),
  ('Business', 'For teams and organizations', 29.99, 299.99, 2000, false, 3)
ON CONFLICT (name) DO NOTHING;

-- Assign features to plans
WITH
  free_plan AS (SELECT id FROM plans WHERE name = 'Free'),
  pro_plan AS (SELECT id FROM plans WHERE name = 'Pro'),
  business_plan AS (SELECT id FROM plans WHERE name = 'Business'),
  screen_rec AS (SELECT id FROM features WHERE feature_key = 'screen_recording'),
  voice_rec AS (SELECT id FROM features WHERE feature_key = 'voice_recording'),
  transcription AS (SELECT id FROM features WHERE feature_key = 'transcription'),
  video_edit AS (SELECT id FROM features WHERE feature_key = 'video_editing'),
  cloud AS (SELECT id FROM features WHERE feature_key = 'cloud_storage'),
  hd AS (SELECT id FROM features WHERE feature_key = 'hd_quality'),
  branding AS (SELECT id FROM features WHERE feature_key = 'custom_branding'),
  team AS (SELECT id FROM features WHERE feature_key = 'team_collaboration')
INSERT INTO plan_features (plan_id, feature_id, limit_value) VALUES
  -- Free plan features
  ((SELECT id FROM free_plan), (SELECT id FROM screen_rec), 10), -- 10 recordings/month
  ((SELECT id FROM free_plan), (SELECT id FROM voice_rec), 10),
  ((SELECT id FROM free_plan), (SELECT id FROM transcription), 5),

  -- Pro plan features
  ((SELECT id FROM pro_plan), (SELECT id FROM screen_rec), NULL), -- unlimited
  ((SELECT id FROM pro_plan), (SELECT id FROM voice_rec), NULL),
  ((SELECT id FROM pro_plan), (SELECT id FROM transcription), NULL),
  ((SELECT id FROM pro_plan), (SELECT id FROM video_edit), NULL),
  ((SELECT id FROM pro_plan), (SELECT id FROM cloud), 100), -- 100GB
  ((SELECT id FROM pro_plan), (SELECT id FROM hd), NULL),

  -- Business plan features
  ((SELECT id FROM business_plan), (SELECT id FROM screen_rec), NULL),
  ((SELECT id FROM business_plan), (SELECT id FROM voice_rec), NULL),
  ((SELECT id FROM business_plan), (SELECT id FROM transcription), NULL),
  ((SELECT id FROM business_plan), (SELECT id FROM video_edit), NULL),
  ((SELECT id FROM business_plan), (SELECT id FROM cloud), NULL), -- unlimited
  ((SELECT id FROM business_plan), (SELECT id FROM hd), NULL),
  ((SELECT id FROM business_plan), (SELECT id FROM branding), NULL),
  ((SELECT id FROM business_plan), (SELECT id FROM team), NULL)
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- Assign free plan to existing users
WITH default_plan AS (SELECT id FROM plans WHERE is_default = true LIMIT 1)
UPDATE users
SET plan_id = (SELECT id FROM default_plan)
WHERE plan_id IS NULL;

-- Insert default landing page content
INSERT INTO landing_page_content (section_key, content_type, content_value) VALUES
  ('hero_title', 'text', 'Professional Screen Recording'),
  ('hero_subtitle', 'text', 'Capture your screen and voice with crystal-clear quality. Perfect for tutorials, presentations, and content creation.'),
  ('feature_1_title', 'text', 'Screen Recording'),
  ('feature_1_desc', 'text', 'Capture your entire screen or specific applications with high quality.'),
  ('feature_2_title', 'text', 'Auto Transcription'),
  ('feature_2_desc', 'text', 'Automatic speech-to-text in 11+ languages with AI enhancement.'),
  ('feature_3_title', 'text', 'Privacy First'),
  ('feature_3_desc', 'text', 'Your recordings stay private. Everything stored locally in your browser. No cloud, no signup needed!')
ON CONFLICT (section_key) DO NOTHING;

COMMENT ON TABLE features IS 'Available features in the system';
COMMENT ON TABLE plans IS 'Subscription plans';
COMMENT ON TABLE plan_features IS 'Features included in each plan';
COMMENT ON TABLE landing_page_content IS 'Customizable landing page content';

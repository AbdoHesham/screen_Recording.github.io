-- ProScreen Recorder Database Schema
-- Migration 001: Initial Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'free' CHECK (role IN ('free', 'pro', 'admin')),
    credits_balance INTEGER DEFAULT 100, -- Welcome bonus
    stripe_customer_id VARCHAR(255),
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Recordings Table
CREATE TABLE recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) CHECK (type IN ('screen', 'voice', 'camera')),
    status VARCHAR(50) DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
    raw_file_url TEXT,
    processed_file_url TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for recordings
CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_recordings_status ON recordings(status);
CREATE INDEX idx_recordings_created_at ON recordings(created_at DESC);

-- Transcriptions Table
CREATE TABLE transcriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE,
    raw_text TEXT,
    enhanced_text TEXT,
    language VARCHAR(10),
    confidence_score DECIMAL(3,2),
    word_timings JSONB,
    filler_words_removed JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create index on recording_id
CREATE INDEX idx_transcriptions_recording_id ON transcriptions(recording_id);

-- Agent Personas Table
CREATE TABLE agent_personas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    capabilities JSONB,
    credit_cost_multiplier DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- AI Processing Jobs Table
CREATE TABLE ai_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    agent_persona_id UUID REFERENCES agent_personas(id),
    job_type VARCHAR(50) CHECK (job_type IN (
        'transcription',
        'audio_cleanup',
        'video_edit',
        'agent_persona',
        'filler_removal',
        'silence_trim',
        'noise_reduction',
        'auto_captions'
    )),
    status VARCHAR(50) DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    parameters JSONB,
    result JSONB,
    credits_used INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for ai_jobs
CREATE INDEX idx_ai_jobs_user_id ON ai_jobs(user_id);
CREATE INDEX idx_ai_jobs_recording_id ON ai_jobs(recording_id);
CREATE INDEX idx_ai_jobs_status ON ai_jobs(status);
CREATE INDEX idx_ai_jobs_created_at ON ai_jobs(created_at DESC);

-- Credit Transactions Table
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    transaction_type VARCHAR(50) CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'bonus', 'admin_grant')),
    description TEXT,
    related_job_id UUID REFERENCES ai_jobs(id),
    stripe_payment_intent_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for credit_transactions
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

-- Credit Packages Table
CREATE TABLE credit_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    credits INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    stripe_price_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Video Editing Projects Table
CREATE TABLE video_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE,
    title VARCHAR(255),
    timeline_data JSONB,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'rendering', 'completed', 'failed')),
    rendered_file_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for video_projects
CREATE INDEX idx_video_projects_user_id ON video_projects(user_id);
CREATE INDEX idx_video_projects_recording_id ON video_projects(recording_id);

-- Subscription Plans Table (for future use)
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    monthly_price_cents INTEGER,
    yearly_price_cents INTEGER,
    features JSONB,
    monthly_credit_allocation INTEGER,
    stripe_product_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recordings_updated_at BEFORE UPDATE ON recordings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_projects_updated_at BEFORE UPDATE ON video_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed initial credit packages
INSERT INTO credit_packages (name, credits, price_cents, is_active) VALUES
    ('Starter Pack', 100, 999, true),
    ('Pro Pack', 500, 3999, true),
    ('Business Pack', 2000, 12999, true);

-- Seed initial agent personas
INSERT INTO agent_personas (name, description, system_prompt, capabilities, credit_cost_multiplier) VALUES
    (
        'Meeting Summarizer',
        'Analyzes meeting recordings to extract key points, action items, and decisions',
        'You are an expert meeting analyst. Your task is to: 1) Identify key discussion points and decisions, 2) Extract action items with assigned owners, 3) Summarize main takeaways, 4) Remove small talk and irrelevant discussions, 5) Highlight timestamps of important moments. Return your analysis as structured JSON.',
        '["transcription", "summarization", "action_items"]'::jsonb,
        1.5
    ),
    (
        'Tutorial Editor',
        'Optimizes tutorial videos by removing mistakes and improving pacing',
        'You are a professional tutorial video editor. Your task is to: 1) Remove mistakes, false starts, and long pauses, 2) Identify and mark key teaching moments, 3) Suggest chapter markers for tutorial sections, 4) Detect repetitive explanations that should be cut, 5) Optimize pacing for learning. Return recommendations as structured JSON.',
        '["audio_cleanup", "chapter_detection", "pacing_optimization"]'::jsonb,
        2.0
    ),
    (
        'Interview Analyzer',
        'Extracts insights and highlights from interview recordings',
        'You are an interview content specialist. Your task is to: 1) Identify and extract key quotes and insights, 2) Detect emotional tone and engagement levels, 3) Highlight compelling moments for highlights, 4) Remove filler words while preserving authenticity, 5) Suggest clip timestamps for social media. Return analysis as structured JSON.',
        '["quote_extraction", "highlight_detection", "sentiment_analysis"]'::jsonb,
        2.5
    );

-- Create a view for user analytics
CREATE VIEW user_stats AS
SELECT
    u.id,
    u.email,
    u.role,
    u.credits_balance,
    COUNT(DISTINCT r.id) as total_recordings,
    COALESCE(SUM(r.duration_seconds), 0) as total_duration_seconds,
    COUNT(DISTINCT aj.id) as total_ai_jobs,
    COALESCE(SUM(aj.credits_used), 0) as total_credits_used,
    COALESCE(SUM(CASE WHEN ct.transaction_type = 'purchase' THEN ct.amount ELSE 0 END), 0) as total_credits_purchased
FROM users u
LEFT JOIN recordings r ON u.id = r.user_id
LEFT JOIN ai_jobs aj ON u.id = aj.user_id
LEFT JOIN credit_transactions ct ON u.id = ct.user_id
GROUP BY u.id, u.email, u.role, u.credits_balance;

-- Comments for documentation
COMMENT ON TABLE users IS 'Stores user accounts with authentication and credit balance';
COMMENT ON TABLE recordings IS 'Stores metadata for all user recordings';
COMMENT ON TABLE transcriptions IS 'Stores transcription data with word timings';
COMMENT ON TABLE ai_jobs IS 'Tracks all AI processing jobs and their status';
COMMENT ON TABLE credit_transactions IS 'Audit log for all credit transactions';
COMMENT ON TABLE agent_personas IS 'Defines AI agent personas with their prompts';
COMMENT ON TABLE credit_packages IS 'Available credit packages for purchase';
COMMENT ON TABLE video_projects IS 'Video editing project data with timeline information';

-- Bug Reports Table
-- Stores family bug reports with state snapshots and audio attachments

CREATE TABLE IF NOT EXISTS bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reporter information (from Supabase auth)
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    user_email TEXT,
    user_display_name TEXT,
    
    -- Report metadata
    severity TEXT CHECK (severity IN ('blocking', 'annoying', 'noticed')) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    
    -- State snapshot (JSON)
    game_state JSONB,
    connection_state JSONB,
    ui_state JSONB,
    user_context JSONB,
    
    -- Action breadcrumbs (JSON array)
    breadcrumbs JSONB,
    
    -- Console capture (JSON array)
    console_capture JSONB,
    
    -- Voice recording
    audio_transcription TEXT,
    audio_file_path TEXT,
    audio_duration_ms INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status TEXT CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
    
    -- Resolution info
    resolution_notes TEXT,
    resolved_by UUID REFERENCES auth.users(id)
);

-- Create indexes for performance
CREATE INDEX idx_bug_reports_user_id ON bug_reports(user_id);
CREATE INDEX idx_bug_reports_status ON bug_reports(status);
CREATE INDEX idx_bug_reports_severity ON bug_reports(severity);
CREATE INDEX idx_bug_reports_created_at ON bug_reports(created_at DESC);

-- Enable Row Level Security
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Family members can view all family bug reports
CREATE POLICY "Family members can view bug reports" ON bug_reports
    FOR SELECT USING (
        -- Users can view their own reports
        auth.uid() = user_id
        OR
        -- Additional family access logic can be added here
        -- For now, users can only see their own reports
        false
    );

-- Users can create bug reports
CREATE POLICY "Users can create bug reports" ON bug_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own bug reports
CREATE POLICY "Users can update their bug reports" ON bug_reports
    FOR UPDATE USING (auth.uid() = user_id);

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'bug-audio',
    'bug-audio',
    false, -- private bucket
    25 * 1024 * 1024, -- 25MB limit
    ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for audio files
CREATE POLICY "Users can upload audio for their bug reports" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'bug-audio' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view their own audio files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'bug-audio' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update their own audio files" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'bug-audio' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own audio files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'bug-audio' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for bug_reports
CREATE TRIGGER update_bug_reports_updated_at
    BEFORE UPDATE ON bug_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE bug_reports IS 'Family bug reports with state snapshots and audio';
COMMENT ON COLUMN bug_reports.severity IS 'How severe the bug is: blocking, annoying, or noticed';
COMMENT ON COLUMN bug_reports.game_state IS 'Serialized game state at time of report';
COMMENT ON COLUMN bug_reports.connection_state IS 'WebSocket and room connection state';
COMMENT ON COLUMN bug_reports.ui_state IS 'Viewport, route, and UI state';
COMMENT ON COLUMN bug_reports.user_context IS 'User authentication and context';
COMMENT ON COLUMN bug_reports.breadcrumbs IS 'Recent user actions leading to the bug';
COMMENT ON COLUMN bug_reports.console_capture IS 'Console output and errors';
COMMENT ON COLUMN bug_reports.audio_transcription IS 'Transcribed voice description of the bug';
COMMENT ON COLUMN bug_reports.audio_file_path IS 'Path to audio file in storage bucket';
COMMENT ON COLUMN bug_reports.audio_duration_ms IS 'Length of audio recording in milliseconds';

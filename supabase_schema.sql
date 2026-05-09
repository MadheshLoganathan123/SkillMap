-- ============================================
-- SkillMap AI Interview Application Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- ============================================
-- 2. INTERVIEW SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.interview_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_id TEXT UNIQUE NOT NULL,
    
    -- Interview Setup Data
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    target_job_role TEXT NOT NULL,
    years_of_experience TEXT NOT NULL,
    skills TEXT[] NOT NULL,
    interview_type TEXT NOT NULL,
    difficulty_level TEXT NOT NULL,
    preferred_language TEXT NOT NULL,
    job_description TEXT,
    company_type TEXT NOT NULL,
    interview_duration INTEGER NOT NULL, -- in minutes
    focus_areas TEXT[] NOT NULL,
    voice_based_interview BOOLEAN DEFAULT FALSE,
    mock_interview_goal TEXT NOT NULL,
    
    -- Session Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;

-- Interview sessions policies
CREATE POLICY "Users can view their own interview sessions" 
    ON public.interview_sessions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own interview sessions" 
    ON public.interview_sessions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interview sessions" 
    ON public.interview_sessions FOR UPDATE 
    USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_interview_sessions_user_id ON public.interview_sessions(user_id);
CREATE INDEX idx_interview_sessions_status ON public.interview_sessions(status);
CREATE INDEX idx_interview_sessions_created_at ON public.interview_sessions(created_at DESC);

-- ============================================
-- 3. INTERVIEW QUESTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.interview_questions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE NOT NULL,
    
    -- Question Details
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    expected_answer TEXT,
    keywords TEXT[],
    
    -- AI Generated Context
    ai_context JSONB,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;

-- Interview questions policies
CREATE POLICY "Users can view questions for their sessions" 
    ON public.interview_questions FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.interview_sessions 
            WHERE interview_sessions.id = interview_questions.session_id 
            AND interview_sessions.user_id = auth.uid()
        )
    );

-- Index for faster queries
CREATE INDEX idx_interview_questions_session_id ON public.interview_questions(session_id);
CREATE INDEX idx_interview_questions_number ON public.interview_questions(session_id, question_number);

-- ============================================
-- 4. INTERVIEW ANSWERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.interview_answers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    question_id UUID REFERENCES public.interview_questions(id) ON DELETE CASCADE NOT NULL,
    session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Answer Details
    answer_text TEXT NOT NULL,
    answer_audio_url TEXT, -- for voice-based interviews
    time_taken INTEGER, -- in seconds
    
    -- AI Evaluation
    ai_score DECIMAL(3,1), -- out of 10
    ai_feedback JSONB, -- {strengths: [], weaknesses: [], improvements: [], sample_answer: ""}
    
    -- Metadata
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    evaluated_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.interview_answers ENABLE ROW LEVEL SECURITY;

-- Interview answers policies
CREATE POLICY "Users can view their own answers" 
    ON public.interview_answers FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own answers" 
    ON public.interview_answers FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_interview_answers_session_id ON public.interview_answers(session_id);
CREATE INDEX idx_interview_answers_question_id ON public.interview_answers(question_id);
CREATE INDEX idx_interview_answers_user_id ON public.interview_answers(user_id);

-- ============================================
-- 5. INTERVIEW RESULTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.interview_results (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Overall Results
    total_questions INTEGER NOT NULL,
    questions_answered INTEGER NOT NULL,
    average_score DECIMAL(3,1),
    total_time_taken INTEGER, -- in seconds
    
    -- Detailed Analysis
    strengths TEXT[],
    weaknesses TEXT[],
    recommendations TEXT[],
    skill_scores JSONB, -- {skill_name: score}
    
    -- Performance Metrics
    communication_score DECIMAL(3,1),
    technical_score DECIMAL(3,1),
    problem_solving_score DECIMAL(3,1),
    
    -- AI Summary
    ai_summary TEXT,
    overall_feedback TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.interview_results ENABLE ROW LEVEL SECURITY;

-- Interview results policies
CREATE POLICY "Users can view their own results" 
    ON public.interview_results FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own results" 
    ON public.interview_results FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own results" 
    ON public.interview_results FOR UPDATE 
    USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_interview_results_user_id ON public.interview_results(user_id);
CREATE INDEX idx_interview_results_session_id ON public.interview_results(session_id);

-- ============================================
-- 6. USER PROGRESS TABLE (for roadmap/progress tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_progress (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Progress Data
    total_interviews INTEGER DEFAULT 0,
    completed_interviews INTEGER DEFAULT 0,
    average_score DECIMAL(3,1),
    skills_practiced TEXT[],
    
    -- Learning Path
    current_level TEXT,
    target_role TEXT,
    learning_goals TEXT[],
    
    -- Statistics
    total_time_spent INTEGER DEFAULT 0, -- in minutes
    streak_days INTEGER DEFAULT 0,
    last_interview_date DATE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- User progress policies
CREATE POLICY "Users can view their own progress" 
    ON public.user_progress FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" 
    ON public.user_progress FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress" 
    ON public.user_progress FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 7. PREDICTION + REALTIME AUDIO DIAGNOSTICS TABLES
-- ============================================
CREATE TABLE IF NOT EXISTS public.skill_effectiveness_predictions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Versioned scoring output for ML migration readiness
    model_version TEXT NOT NULL,
    skill_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    feature_vector JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence DECIMAL(5,4), -- 0.0000 to 1.0000
    explanation TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.skill_effectiveness_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own skill predictions"
    ON public.skill_effectiveness_predictions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own skill predictions"
    ON public.skill_effectiveness_predictions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own skill predictions"
    ON public.skill_effectiveness_predictions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_skill_predictions_user_id
    ON public.skill_effectiveness_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_predictions_session_id
    ON public.skill_effectiveness_predictions(session_id);
CREATE INDEX IF NOT EXISTS idx_skill_predictions_created_at
    ON public.skill_effectiveness_predictions(created_at DESC);

-- Optional time-series table for per-answer/per-turn skill trajectories
CREATE TABLE IF NOT EXISTS public.skill_effectiveness_timeseries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES public.interview_questions(id) ON DELETE SET NULL,
    answer_id UUID REFERENCES public.interview_answers(id) ON DELETE SET NULL,
    turn_index INTEGER NOT NULL DEFAULT 0,

    model_version TEXT NOT NULL,
    skill_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    feature_vector JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence DECIMAL(5,4),
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.skill_effectiveness_timeseries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own skill timeseries"
    ON public.skill_effectiveness_timeseries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own skill timeseries"
    ON public.skill_effectiveness_timeseries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_skill_timeseries_user_id
    ON public.skill_effectiveness_timeseries(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_timeseries_session_id
    ON public.skill_effectiveness_timeseries(session_id);
CREATE INDEX IF NOT EXISTS idx_skill_timeseries_created_at
    ON public.skill_effectiveness_timeseries(created_at DESC);

-- Realtime voice diagnostics and transcript stream events
CREATE TABLE IF NOT EXISTS public.interview_audio_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES public.interview_questions(id) ON DELETE SET NULL,
    answer_id UUID REFERENCES public.interview_answers(id) ON DELETE SET NULL,

    sequence_no INTEGER NOT NULL DEFAULT 0,
    event_type TEXT NOT NULL, -- audio_chunk | partial_transcript | final_transcript | tts_request | tts_response
    transcript_text TEXT,
    confidence DECIMAL(5,4),
    audio_url TEXT,
    provider TEXT,
    latency_ms INTEGER,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.interview_audio_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audio events"
    ON public.interview_audio_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own audio events"
    ON public.interview_audio_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_audio_events_user_id
    ON public.interview_audio_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_events_session_id
    ON public.interview_audio_events(session_id);
CREATE INDEX IF NOT EXISTS idx_audio_events_created_at
    ON public.interview_audio_events(created_at DESC);

-- ============================================
-- 8. FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_sessions_updated_at BEFORE UPDATE ON public.interview_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_results_updated_at BEFORE UPDATE ON public.interview_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON public.user_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    
    INSERT INTO public.user_progress (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 9. STORAGE BUCKETS (for audio files, avatars, etc.)
-- ============================================

-- Create storage bucket for interview audio recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('interview-audio', 'interview-audio', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for user avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for interview audio
CREATE POLICY "Users can upload their own audio"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'interview-audio' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own audio"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'interview-audio' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for avatars
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- COMPLETED!
-- ============================================
-- Run this entire script in your Supabase SQL Editor
-- Make sure to enable RLS on all tables for security

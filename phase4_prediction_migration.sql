-- ============================================
-- SkillMap Phase 4 Migration (Idempotent)
-- Prediction readiness + realtime audio diagnostics
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1) skill_effectiveness_predictions
-- ============================================
CREATE TABLE IF NOT EXISTS public.skill_effectiveness_predictions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    model_version TEXT NOT NULL,
    skill_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    feature_vector JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence DECIMAL(5,4),
    explanation TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.skill_effectiveness_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own skill predictions" ON public.skill_effectiveness_predictions;
CREATE POLICY "Users can view their own skill predictions"
    ON public.skill_effectiveness_predictions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own skill predictions" ON public.skill_effectiveness_predictions;
CREATE POLICY "Users can create their own skill predictions"
    ON public.skill_effectiveness_predictions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own skill predictions" ON public.skill_effectiveness_predictions;
CREATE POLICY "Users can update their own skill predictions"
    ON public.skill_effectiveness_predictions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_skill_predictions_user_id
    ON public.skill_effectiveness_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_predictions_session_id
    ON public.skill_effectiveness_predictions(session_id);
CREATE INDEX IF NOT EXISTS idx_skill_predictions_created_at
    ON public.skill_effectiveness_predictions(created_at DESC);

-- ============================================
-- 2) skill_effectiveness_timeseries (optional)
-- ============================================
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

DROP POLICY IF EXISTS "Users can view their own skill timeseries" ON public.skill_effectiveness_timeseries;
CREATE POLICY "Users can view their own skill timeseries"
    ON public.skill_effectiveness_timeseries FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own skill timeseries" ON public.skill_effectiveness_timeseries;
CREATE POLICY "Users can create their own skill timeseries"
    ON public.skill_effectiveness_timeseries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_skill_timeseries_user_id
    ON public.skill_effectiveness_timeseries(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_timeseries_session_id
    ON public.skill_effectiveness_timeseries(session_id);
CREATE INDEX IF NOT EXISTS idx_skill_timeseries_created_at
    ON public.skill_effectiveness_timeseries(created_at DESC);

-- ============================================
-- 3) interview_audio_events
-- ============================================
CREATE TABLE IF NOT EXISTS public.interview_audio_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES public.interview_questions(id) ON DELETE SET NULL,
    answer_id UUID REFERENCES public.interview_answers(id) ON DELETE SET NULL,
    sequence_no INTEGER NOT NULL DEFAULT 0,
    event_type TEXT NOT NULL,
    transcript_text TEXT,
    confidence DECIMAL(5,4),
    audio_url TEXT,
    provider TEXT,
    latency_ms INTEGER,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.interview_audio_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own audio events" ON public.interview_audio_events;
CREATE POLICY "Users can view their own audio events"
    ON public.interview_audio_events FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own audio events" ON public.interview_audio_events;
CREATE POLICY "Users can create their own audio events"
    ON public.interview_audio_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_audio_events_user_id
    ON public.interview_audio_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_events_session_id
    ON public.interview_audio_events(session_id);
CREATE INDEX IF NOT EXISTS idx_audio_events_created_at
    ON public.interview_audio_events(created_at DESC);

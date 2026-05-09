# Supabase Setup Guide for SkillMap AI Interview

## Step 1: Run the SQL Schema

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `supabase_schema.sql`
5. Paste it into the SQL editor
6. Click **Run** to execute the script

This will create:
- ✅ User profiles table
- ✅ Interview sessions table
- ✅ Interview questions table
- ✅ Interview answers table
- ✅ Interview results table
- ✅ User progress table
- ✅ Row Level Security (RLS) policies
- ✅ Storage buckets for audio and avatars
- ✅ Automatic triggers and functions

## Step 2: Verify Tables Created

After running the script, verify in the **Table Editor**:

1. Click **Table Editor** in the left sidebar
2. You should see these tables:
   - `profiles`
   - `interview_sessions`
   - `interview_questions`
   - `interview_answers`
   - `interview_results`
   - `user_progress`

## Step 3: Check Storage Buckets

1. Navigate to **Storage** in the left sidebar
2. You should see two buckets:
   - `interview-audio` (private)
   - `avatars` (public)

## Step 4: Environment Variables

Make sure your `.env.local` file has:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Get these from:
- Supabase Dashboard → Settings → API

## Step 5: Test the Integration

1. Start your Next.js development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/interview-setup`
3. Fill out the interview setup form
4. Click "Start Interview"
5. Check Supabase Table Editor to see if data was saved in `interview_sessions`

## Database Schema Overview

### interview_sessions
Stores all interview setup configurations and session metadata.

**Key Fields:**
- `session_id`: Unique identifier for the interview
- `user_id`: References the authenticated user
- `target_job_role`, `skills`, `focus_areas`: Interview configuration
- `status`: pending, in_progress, completed, cancelled
- `interview_duration`: Duration in minutes

### interview_questions
Stores AI-generated questions for each interview session.

**Key Fields:**
- `session_id`: Links to interview_sessions
- `question_number`: Order of the question
- `question_text`: The actual question
- `question_type`: technical, behavioral, hr, system-design
- `difficulty`: easy, medium, hard

### interview_answers
Stores user answers and AI evaluations.

**Key Fields:**
- `question_id`: Links to interview_questions
- `answer_text`: User's text answer
- `answer_audio_url`: URL for voice recordings (optional)
- `ai_score`: Score out of 10
- `ai_feedback`: JSON with strengths, weaknesses, improvements

### interview_results
Stores overall interview performance and analytics.

**Key Fields:**
- `session_id`: Links to interview_sessions
- `average_score`: Overall performance score
- `strengths`, `weaknesses`, `recommendations`: Arrays of feedback
- `skill_scores`: JSON object with per-skill scores

### user_progress
Tracks user's learning journey and statistics.

**Key Fields:**
- `total_interviews`: Count of all interviews
- `completed_interviews`: Count of finished interviews
- `average_score`: Overall average performance
- `streak_days`: Consecutive days of practice

## Security Features

✅ **Row Level Security (RLS)** enabled on all tables
✅ Users can only access their own data
✅ Automatic user profile creation on signup
✅ Secure storage policies for audio and avatars

## Next Steps

1. ✅ Run the SQL schema (completed)
2. ⏳ Integrate Python AI backend for question generation
3. ⏳ Implement answer evaluation with AI
4. ⏳ Add voice recording functionality
5. ⏳ Build results and analytics dashboard

## Troubleshooting

### Error: "relation does not exist"
- Make sure you ran the entire SQL script
- Check that RLS is enabled on tables

### Error: "permission denied"
- Verify RLS policies are created
- Check that user is authenticated

### Error: "Failed to save interview setup"
- Check browser console for detailed error
- Verify Supabase credentials in `.env.local`
- Check network tab for API response

## Support

If you encounter issues:
1. Check Supabase logs in Dashboard → Logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Ensure user is authenticated before accessing interview pages

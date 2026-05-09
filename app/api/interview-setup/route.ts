import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate required fields
    const requiredFields = [
      'fullName',
      'email',
      'targetJobRole',
      'yearsOfExperience',
      'skills',
      'interviewType',
      'difficultyLevel',
      'preferredLanguage',
      'companyType',
      'interviewDuration',
      'focusAreas',
      'voiceBasedInterview',
      'mockInterviewGoal',
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Generate unique session ID
    const sessionId = `interview_${Date.now()}_${user.id.substring(0, 8)}`;

    // Save interview session to database
    const { data: session, error: dbError } = await supabase
      .from('interview_sessions')
      .insert({
        user_id: user.id,
        session_id: sessionId,
        full_name: body.fullName,
        email: body.email,
        target_job_role: body.targetJobRole,
        years_of_experience: body.yearsOfExperience,
        skills: body.skills,
        interview_type: body.interviewType,
        difficulty_level: body.difficultyLevel,
        preferred_language: body.preferredLanguage,
        job_description: body.jobDescription || null,
        company_type: body.companyType,
        interview_duration: parseInt(body.interviewDuration),
        focus_areas: body.focusAreas,
        voice_based_interview: body.voiceBasedInterview === 'yes',
        mock_interview_goal: body.mockInterviewGoal,
        status: 'pending',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to save interview setup' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Interview setup completed successfully',
      sessionId: sessionId,
      sessionData: session,
    });
  } catch (error) {
    console.error('Interview setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup interview' },
      { status: 500 }
    );
  }
}

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
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    // Fetch session data from database
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if questions already exist for this session
    const { data: existingQuestions } = await supabase
      .from('interview_questions')
      .select('*')
      .eq('session_id', session.id)
      .order('question_number');

    if (existingQuestions && existingQuestions.length > 0) {
      return NextResponse.json({
        success: true,
        questions: existingQuestions.map(q => ({
          id: q.id,
          questionNumber: q.question_number,
          question: q.question_text,
          type: q.question_type,
          difficulty: q.difficulty,
        })),
        totalQuestions: existingQuestions.length,
      });
    }

    // Generate questions based on interview setup
    // TODO: Call Python backend AI service to generate questions
    // For now, generate mock questions
    const mockQuestions = generateMockQuestions(session);

    // Save questions to database
    const questionsToInsert = mockQuestions.map((q, index) => ({
      session_id: session.id,
      question_number: index + 1,
      question_text: q.question,
      question_type: q.type,
      difficulty: session.difficulty_level,
      keywords: q.keywords || [],
    }));

    const { data: savedQuestions, error: insertError } = await supabase
      .from('interview_questions')
      .insert(questionsToInsert)
      .select();

    if (insertError) {
      console.error('Error saving questions:', insertError);
      return NextResponse.json(
        { error: 'Failed to save questions' },
        { status: 500 }
      );
    }

    // Update session status to in_progress
    await supabase
      .from('interview_sessions')
      .update({ 
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('id', session.id);

    return NextResponse.json({
      success: true,
      questions: savedQuestions.map(q => ({
        id: q.id,
        questionNumber: q.question_number,
        question: q.question_text,
        type: q.question_type,
        difficulty: q.difficulty,
      })),
      totalQuestions: savedQuestions.length,
    });
  } catch (error) {
    console.error('Question generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
}

function generateMockQuestions(session: any) {
  const questions = [];
  const { target_job_role, skills, interview_type, focus_areas } = session;

  // Technical question
  if (interview_type === 'technical' || interview_type === 'mixed') {
    questions.push({
      question: `Explain the key technical concepts required for a ${target_job_role} role.`,
      type: 'technical',
      keywords: skills,
    });

    if (skills.length > 0) {
      questions.push({
        question: `Describe your experience with ${skills[0]} and how you've applied it in real projects.`,
        type: 'technical',
        keywords: [skills[0]],
      });
    }
  }

  // Behavioral question
  if (interview_type === 'behavioral' || interview_type === 'mixed' || interview_type === 'hr') {
    questions.push({
      question: 'Tell me about a challenging project you worked on and how you overcame obstacles.',
      type: 'behavioral',
      keywords: ['problem-solving', 'teamwork'],
    });
  }

  // Focus area questions
  if (focus_areas.length > 0) {
    questions.push({
      question: `How would you approach solving a problem related to ${focus_areas[0]}?`,
      type: 'technical',
      keywords: [focus_areas[0]],
    });
  }

  // System design (if applicable)
  if (interview_type === 'system-design') {
    questions.push({
      question: `Design a scalable system for a ${target_job_role} application. Explain your architecture choices.`,
      type: 'system-design',
      keywords: ['architecture', 'scalability', 'design'],
    });
  }

  return questions.slice(0, 4); // Return max 4 questions
}

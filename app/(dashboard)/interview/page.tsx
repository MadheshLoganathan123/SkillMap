'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mic } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { VoiceInterview } from '@/components/interview/voice-interview';
import { getReconnectDelayMs, shouldSwitchToFallback } from './realtime-utils';

interface InterviewSetup {
  fullName: string;
  email: string;
  targetJobRole: string;
  yearsOfExperience: string;
  skills: string[];
  interviewType: string;
  difficultyLevel: string;
  preferredLanguage: string;
  jobDescription: string;
  companyType: string;
  interviewDuration: string;
  focusAreas: string[];
  voiceBasedInterview: string;
  mockInterviewGoal: string;
}

interface Question {
  id: string;
  questionNumber: number;
  question: string;
  type: string;
  difficulty: string;
}

type InterviewStatus = 'idle' | 'listening' | 'transcribing' | 'evaluating' | 'asking_next_question';
type TranscriptEntryType = 'partial' | 'final' | 'system';

interface TranscriptEntry {
  id: string;
  type: TranscriptEntryType;
  text: string;
  confidence?: number;
  createdAt: number;
}

const TranscriptTimelinePanel = memo(function TranscriptTimelinePanel({
  transcriptTimeline,
}: {
  transcriptTimeline: TranscriptEntry[];
}) {
  return (
    <Card className="bg-card">
      <CardContent className="p-6">
        <h3 className="text-xl font-semibold mb-3">Transcript Timeline</h3>
        <div className="space-y-2 max-h-56 overflow-auto pr-1">
          {transcriptTimeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transcript chunks yet.</p>
          ) : (
            transcriptTimeline.map((entry) => (
              <div key={entry.id} className="rounded border p-2 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant={entry.type === 'final' ? 'default' : 'secondary'}>
                    {entry.type}
                  </Badge>
                  {typeof entry.confidence === 'number' && (
                    <span className="text-xs text-muted-foreground">
                      conf: {(entry.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p>{entry.text}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
});

export default function InterviewPage() {
  const router = useRouter();
  const { toast } = useToast();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
  const voiceInterviewEnabled = process.env.NEXT_PUBLIC_VOICE_INTERVIEW_V1 === 'true';
  const [setupData, setSetupData] = useState<InterviewSetup | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [transcriptTimeline, setTranscriptTimeline] = useState<TranscriptEntry[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [wsState, setWsState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [interviewStatus, setInterviewStatus] = useState<InterviewStatus>('idle');
  const [realtimeModeEnabled, setRealtimeModeEnabled] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const partialDebounceRef = useRef<number | null>(null);
  const finalQueueRef = useRef<Array<{ text: string; confidence?: number }>>([]);
  const flushFrameRef = useRef<number | null>(null);
  const latestFinalTranscriptRef = useRef('');
  const answerStartedAtRef = useRef<number>(Date.now());
  const answerSubmitAtRef = useRef<number | null>(null);
  const questionShownAtRef = useRef<number | null>(null);

  const QUESTION_TO_PLAYBACK_BUDGET_MS = 2000;
  const ANSWER_TO_EVALUATION_BUDGET_MS = 3500;

  useEffect(() => {
    const data = sessionStorage.getItem('interviewSetup');
    const storedSessionId = sessionStorage.getItem('interviewSessionId');
    const storedSessionUuid = sessionStorage.getItem('interviewSessionUuid');
    
    if (!data || !storedSessionId) {
      router.push('/interview-setup');
      return;
    }
    
    const parsed = JSON.parse(data) as InterviewSetup;
    setSetupData(parsed);
    setSessionId(storedSessionId);
    setTimeRemaining(parseInt(parsed.interviewDuration) * 60);
    
    // HTTP fallback question load
    if (storedSessionUuid) {
      fetchQuestions(storedSessionUuid);
    }
  }, [router]);

  const addTimelineEntry = useCallback((entry: Omit<TranscriptEntry, 'id' | 'createdAt'>) => {
    setTranscriptTimeline(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        ...entry,
      },
    ].slice(-25));
  }, []);

  const wsUrl = useMemo(() => {
    if (!sessionId) return null;
    const url = new URL(apiBase);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/api/interview/ws/${sessionId}`;
  }, [apiBase, sessionId]);

  const fetchQuestions = async (sessionUuid: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${apiBase}/api/interview/session/${sessionUuid}`);

      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }

      const result = await response.json();
      if (result.success && result.data.questions) {
        setQuestions(result.data.questions.map((q: any) => ({
          id: q.id,
          questionNumber: q.question_number,
          question: q.question_text,
          type: q.question_type,
          difficulty: q.difficulty
        })));
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load interview questions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')} : ${secs.toString().padStart(2, '0')}`;
  };

  const [evaluation, setEvaluation] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isVoiceMode = setupData?.voiceBasedInterview === 'yes' && realtimeModeEnabled && voiceInterviewEnabled;

  const cleanupWs = useCallback(() => {
    if (heartbeatRef.current) {
      window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsState('disconnected');
  }, []);

  const requestReconnect = useCallback(() => {
    if (!wsUrl || !realtimeModeEnabled) return;
    if (shouldSwitchToFallback(reconnectAttemptsRef.current, 5)) {
      setRealtimeModeEnabled(false);
      setWsState('disconnected');
      addTimelineEntry({
        type: 'system',
        text: 'Realtime voice unavailable, switched to text-only fallback mode.',
      });
      return;
    }
    const delay = getReconnectDelayMs(reconnectAttemptsRef.current);
    reconnectAttemptsRef.current += 1;
    reconnectTimeoutRef.current = window.setTimeout(() => {
      connectWs();
    }, delay);
  }, [addTimelineEntry, realtimeModeEnabled, wsUrl]);

  const flushFinalQueue = useCallback(() => {
    if (flushFrameRef.current) {
      window.cancelAnimationFrame(flushFrameRef.current);
      flushFrameRef.current = null;
    }
    if (finalQueueRef.current.length === 0) return;
    const items = [...finalQueueRef.current];
    finalQueueRef.current = [];
    const merged = items.map((i) => i.text.trim()).filter(Boolean).join(' ').trim();
    if (merged && merged !== latestFinalTranscriptRef.current) {
      latestFinalTranscriptRef.current = merged;
      setAnswer((prev) => `${prev} ${merged}`.trim());
      setTranscriptTimeline((prev) => {
        const next = [...prev];
        items.forEach((item) => {
          next.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'final',
            text: item.text,
            confidence: item.confidence,
            createdAt: Date.now(),
          });
        });
        return next.slice(-25);
      });
    }
  }, []);

  const enqueueFinalTranscript = useCallback((text: string, confidence?: number) => {
    if (!text.trim()) return;
    finalQueueRef.current.push({ text, confidence });
    if (flushFrameRef.current) return;
    flushFrameRef.current = window.requestAnimationFrame(flushFinalQueue);
  }, [flushFinalQueue]);

  const connectWs = useCallback(() => {
    if (!wsUrl || !setupData || setupData.voiceBasedInterview !== 'yes' || !realtimeModeEnabled || !voiceInterviewEnabled) return;
    cleanupWs();
    setWsState('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsState('connected');
      reconnectAttemptsRef.current = 0;
      ws.send(JSON.stringify({ type: 'session_init' }));
      heartbeatRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, 15000);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data || '{}');
      if (msg.type === 'session_init' && msg.next_question) {
        const q = msg.next_question;
        setQuestions(prev => {
          const exists = prev.find(item => item.id === q.id);
          if (exists) return prev;
          return [...prev, {
            id: q.id,
            questionNumber: q.question_number,
            question: q.question_text,
            type: q.question_type,
            difficulty: q.difficulty,
          }];
        });
        questionShownAtRef.current = performance.now();
      }

      if (msg.type === 'partial_transcript') {
        setInterviewStatus('transcribing');
        if (partialDebounceRef.current) {
          window.clearTimeout(partialDebounceRef.current);
        }
        partialDebounceRef.current = window.setTimeout(() => {
          setPartialTranscript(msg.transcript || '');
        }, 120);
      }

      if (msg.type === 'final_transcript') {
        const text = (msg.transcript || '').trim();
        enqueueFinalTranscript(text, msg.confidence);
        setPartialTranscript('');
        setInterviewStatus('idle');
      }

      if (msg.type === 'evaluation' && msg.evaluation) {
        const now = performance.now();
        if (answerSubmitAtRef.current) {
          const delta = Math.round(now - answerSubmitAtRef.current);
          if (delta > ANSWER_TO_EVALUATION_BUDGET_MS) {
            addTimelineEntry({
              type: 'system',
              text: `Latency warning: answer->evaluation ${delta}ms (budget ${ANSWER_TO_EVALUATION_BUDGET_MS}ms)`,
            });
          }
        }
        setEvaluation(msg.evaluation);
        setInterviewStatus('asking_next_question');
      }

      if (msg.type === 'next_question' && msg.question) {
        const q = msg.question;
        setQuestions(prev => {
          const exists = prev.find(item => item.id === q.id);
          if (exists) return prev;
          return [...prev, {
            id: q.id,
            questionNumber: q.question_number,
            question: q.question_text,
            type: q.question_type,
            difficulty: q.difficulty,
          }];
        });
        questionShownAtRef.current = performance.now();
      }

      if (msg.type === 'session_complete') {
        handleInterviewEnd();
      }

      if (msg.type === 'error') {
        addTimelineEntry({ type: 'system', text: `WS error: ${msg.message || 'unknown error'}` });
        setRealtimeModeEnabled(false);
        cleanupWs();
      }
    };

    ws.onclose = () => {
      setWsState('disconnected');
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      requestReconnect();
    };

    ws.onerror = () => {
      setWsState('disconnected');
      if (reconnectAttemptsRef.current >= 4) {
        setRealtimeModeEnabled(false);
      }
    };
  }, [ANSWER_TO_EVALUATION_BUDGET_MS, addTimelineEntry, cleanupWs, enqueueFinalTranscript, realtimeModeEnabled, requestReconnect, setupData, voiceInterviewEnabled, wsUrl]);

  useEffect(() => {
    if (!setupData || !sessionId || setupData.voiceBasedInterview !== 'yes' || !realtimeModeEnabled || !voiceInterviewEnabled) return;
    connectWs();
    return () => cleanupWs();
  }, [cleanupWs, connectWs, realtimeModeEnabled, sessionId, setupData, voiceInterviewEnabled]);

  const handleInterviewEnd = useCallback(() => {
    toast({
      title: 'Interview Completed',
      description: 'Redirecting to results...',
    });
    setTimeout(() => {
      router.push('/progress');
    }, 2000);
  }, [router, toast]);

  useEffect(() => {
    if (!setupData || isLoading) return;
    if (timerRef.current) return;
    timerRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          handleInterviewEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [handleInterviewEnd, isLoading, setupData]);

  useEffect(() => {
    return () => {
      if (partialDebounceRef.current) {
        window.clearTimeout(partialDebounceRef.current);
      }
      if (flushFrameRef.current) {
        window.cancelAnimationFrame(flushFrameRef.current);
      }
    };
  }, []);

  const handleSubmitAnswer = async () => {
    if (!answer.trim() || !sessionId) return;

    try {
      setIsSubmitting(true);
      setInterviewStatus('evaluating');
      const currentQuestion = questions[currentQuestionIndex];

      const timeTaken = Math.max(0, Math.round((Date.now() - answerStartedAtRef.current) / 1000));
      const payload = {
        type: 'answer_submit',
        session_id: sessionId,
        question_id: currentQuestion.id,
        answer_text: answer,
        time_taken: timeTaken,
      };
      answerSubmitAtRef.current = performance.now();

      // Realtime path
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isVoiceMode) {
        wsRef.current.send(JSON.stringify(payload));
        return;
      }

      // Manual fallback path
      const response = await fetch(`${apiBase}/api/interview/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: currentQuestion.id,
          answer_text: answer,
          time_taken: timeTaken,
        }),
      });
      if (!response.ok) throw new Error('Failed to submit answer');

      const result = await response.json();
      const delta = answerSubmitAtRef.current ? Math.round(performance.now() - answerSubmitAtRef.current) : null;
      if (delta && delta > ANSWER_TO_EVALUATION_BUDGET_MS) {
        addTimelineEntry({
          type: 'system',
          text: `Latency warning: answer->evaluation ${delta}ms (budget ${ANSWER_TO_EVALUATION_BUDGET_MS}ms)`,
        });
      }
      if (!result.success) throw new Error('Evaluation failed');
      setEvaluation(result.evaluation);

      if (result.evaluation.next_question) {
        const nextQ = result.evaluation.next_question;
        setQuestions(prev => {
          const exists = prev.find(q => q.id === nextQ.id);
          if (exists) return prev;
          return [...prev, {
            id: nextQ.id,
            questionNumber: nextQ.question_number,
            question: nextQ.question_text,
            type: nextQ.question_type,
            difficulty: nextQ.difficulty,
          }];
        });
      }

      if (result.evaluation.is_last_question) {
        handleInterviewEnd();
      } else {
        setTimeout(() => {
          setCurrentQuestionIndex(prev => prev + 1);
          setAnswer('');
          setPartialTranscript('');
          setEvaluation(null);
          answerStartedAtRef.current = Date.now();
          setInterviewStatus('idle');
        }, 1500);
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit answer and get evaluation',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusTextMap: Record<InterviewStatus, string> = {
    idle: 'Idle',
    listening: 'Listening',
    transcribing: 'Transcribing',
    evaluating: 'Evaluating',
    asking_next_question: 'Asking next question',
  };

  useEffect(() => {
    answerStartedAtRef.current = Date.now();
    latestFinalTranscriptRef.current = '';
    setPartialTranscript('');
  }, [currentQuestionIndex]);

  if (isLoading || !setupData || questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-lg">Loading your interview...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Welcome back, {setupData.fullName}!</h1>
          <p className="text-muted-foreground">Your career cockpit: Analyze, learn, and grow.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* AI Avatar Card */}
            <Card className="bg-gradient-to-br from-teal-500 to-teal-600">
              <CardContent className="p-8 flex items-center justify-center">
                <div className="w-full h-64 flex items-center justify-center">
                  <div className="text-white text-center">
                    <div className="text-8xl mb-4 animate-pulse">🤖</div>
                    <p className="text-xl font-semibold">AI Interviewer</p>
                      <p className="text-sm opacity-90 mt-2">{statusTextMap[interviewStatus]}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Question Card */}
            <Card className="bg-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Mic className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-semibold">AI Question</h3>
                  <Badge variant="outline" className="ml-auto">
                    {currentQuestion.type}
                  </Badge>
                </div>
                <p className="text-lg mb-4 leading-relaxed">
                  {currentQuestion.question}
                </p>
                <div className="flex gap-2 mb-3">
                  <Badge variant="outline">{statusTextMap[interviewStatus]}</Badge>
                  <Badge variant={wsState === 'connected' ? 'default' : 'secondary'}>
                    WS: {wsState}
                  </Badge>
                  {(!realtimeModeEnabled || !voiceInterviewEnabled) && (
                    <Badge variant="secondary">Fallback: HTTP text mode</Badge>
                  )}
                </div>
                <div className="flex justify-center gap-2 mt-6">
                  {questions.map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 w-2 rounded-full transition-all ${
                        i < currentQuestionIndex + 1 ? 'bg-primary w-8' : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Interview Progress Card */}
            <Card className="bg-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-5 w-5 rounded-full border-2 border-primary" />
                  <h3 className="text-xl font-semibold">Interview Progress</h3>
                </div>
                <div className="flex items-center justify-center py-8">
                  <div className="relative w-40 h-40">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        className="text-muted"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 70}`}
                        strokeDashoffset={`${2 * Math.PI * 70 * (1 - progress / 100)}`}
                        className="text-orange-500 transition-all duration-500"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold">{Math.round(progress)}%</span>
                      <span className="text-sm text-muted-foreground">
                        Question {currentQuestionIndex + 1} of {questions.length}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timer */}
            <Card className="bg-card">
              <CardContent className="p-6 text-center">
                <div className={`text-4xl font-bold mb-2 ${timeRemaining < 60 ? 'text-red-500' : ''}`}>
                  {formatTime(timeRemaining)}
                </div>
                <div className="text-sm text-muted-foreground">Remaining</div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Interview Setup Summary */}
            <Card className="bg-card">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">Interview Setup Summary</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Job Role:</span> {setupData.targetJobRole}
                  </div>
                  <div>
                    <span className="font-medium">Skills:</span>{' '}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {setupData.skills.map(skill => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Level:</span> {setupData.difficultyLevel}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {setupData.interviewType}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Your Answer Card */}
            <Card className="bg-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-5 w-5">✏️</div>
                  <h3 className="text-xl font-semibold">Your Answer</h3>
                </div>
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Voice transcript will appear here. You can edit manually before submit."
                  rows={8}
                  className="mb-4"
                />
                {partialTranscript && (
                  <div className="mb-4 rounded-md border p-3 text-sm bg-muted/30">
                    <p className="text-muted-foreground text-xs mb-1">Live transcript (partial)</p>
                    <p>{partialTranscript}</p>
                  </div>
                )}
                <div className="flex gap-4">
                  <Button
                    onClick={handleSubmitAnswer}
                    className="flex-1 bg-teal-500 hover:bg-teal-600"
                    disabled={!answer.trim() || isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : (currentQuestionIndex < questions.length - 1 ? 'Submit & Next' : 'Submit & Finish')}
                  </Button>
                  <VoiceInterview
                    isEnabled={setupData.voiceBasedInterview === 'yes' && voiceInterviewEnabled}
                    onPartialTranscript={(text) => {
                      if (partialDebounceRef.current) {
                        window.clearTimeout(partialDebounceRef.current);
                      }
                      partialDebounceRef.current = window.setTimeout(() => setPartialTranscript(text), 120);
                      setInterviewStatus('transcribing');
                    }}
                    onFinalTranscript={(text, confidence) => {
                      enqueueFinalTranscript(text, confidence);
                      setInterviewStatus('idle');
                    }}
                    onStatusChange={(status) => {
                      if (status === 'listening') setInterviewStatus('listening');
                      if (status === 'transcribing') setInterviewStatus('transcribing');
                      if (status === 'idle') setInterviewStatus('idle');
                    }}
                    questionText={currentQuestion.question}
                    autoSpeak={true}
                    onSpeechPlaybackStart={() => {
                      if (!questionShownAtRef.current) return;
                      const delta = Math.round(performance.now() - questionShownAtRef.current);
                      if (delta > QUESTION_TO_PLAYBACK_BUDGET_MS) {
                        addTimelineEntry({
                          type: 'system',
                          text: `Latency warning: question->playback ${delta}ms (budget ${QUESTION_TO_PLAYBACK_BUDGET_MS}ms)`,
                        });
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
            <TranscriptTimelinePanel transcriptTimeline={transcriptTimeline} />

            {/* AI Evaluation Card */}
            <Card className="bg-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">✨</span>
                  <h3 className="text-xl font-semibold">AI Evaluation</h3>
                </div>
                {evaluation ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Score:</span>
                      <Badge variant={evaluation.score >= 7 ? "default" : "destructive"}>
                        {evaluation.score}/10
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-teal-500">Strengths:</p>
                      <ul className="text-xs list-disc list-inside mt-1">
                        {evaluation.feedback.strengths.slice(0, 2).map((s: string, i: number) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-amber-500">Improvements:</p>
                      <ul className="text-xs list-disc list-inside mt-1">
                        {evaluation.feedback.improvements.slice(0, 2).map((s: string, i: number) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {isSubmitting || interviewStatus === 'evaluating' ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <p>AI is evaluating your answer...</p>
                      </div>
                    ) : (
                      <p>Submit your answer to receive AI feedback</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

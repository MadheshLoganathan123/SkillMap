'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface VoiceInterviewProps {
  isEnabled: boolean;
  onPartialTranscript: (text: string, confidence?: number) => void;
  onFinalTranscript: (text: string, confidence?: number) => void;
  onStatusChange?: (status: 'idle' | 'listening' | 'transcribing') => void;
  questionText: string;
  autoSpeak?: boolean;
  autoStopSilenceMs?: number;
  onSpeechPlaybackStart?: () => void;
  onSpeechPlaybackEnd?: () => void;
}

export function VoiceInterview({ 
  isEnabled, 
  onPartialTranscript,
  onFinalTranscript,
  onStatusChange,
  questionText,
  autoSpeak = true,
  autoStopSilenceMs = 2500,
  onSpeechPlaybackStart,
  onSpeechPlaybackEnd,
}: VoiceInterviewProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isPushToTalk, setIsPushToTalk] = useState(true);

  const recognitionRef = useRef<any>(null);
  const shouldKeepRecordingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const silenceTimeoutRef = useRef<number | null>(null);
  const partialDebounceRef = useRef<number | null>(null);
  const lastFinalRef = useRef('');
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const onPartialRef = useRef(onPartialTranscript);
  const onFinalRef = useRef(onFinalTranscript);
  const onStatusRef = useRef(onStatusChange);

  useEffect(() => {
    onPartialRef.current = onPartialTranscript;
    onFinalRef.current = onFinalTranscript;
    onStatusRef.current = onStatusChange;
  }, [onFinalTranscript, onPartialTranscript, onStatusChange]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const speechSynthesis = window.speechSynthesis;

    if (SpeechRecognition && speechSynthesis) {
      setIsSupported(true);
      synthRef.current = speechSynthesis;

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = (event.results[i][0].transcript || '').trim();
          const confidence = event.results[i][0].confidence;
          if (!transcript) continue;

          if (event.results[i].isFinal) {
            if (transcript !== lastFinalRef.current) {
              lastFinalRef.current = transcript;
              onFinalRef.current(transcript, confidence);
            }
          } else {
            interimTranscript = transcript;
            if (partialDebounceRef.current) {
              window.clearTimeout(partialDebounceRef.current);
            }
            partialDebounceRef.current = window.setTimeout(() => {
              onPartialRef.current(interimTranscript, confidence);
            }, 120);
          }
        }

        if (interimTranscript) {
          onStatusRef.current?.('transcribing');
        }

        if (silenceTimeoutRef.current) {
          window.clearTimeout(silenceTimeoutRef.current);
        }
        silenceTimeoutRef.current = window.setTimeout(() => {
          if (isPushToTalk) return;
          if (isRecordingRef.current) {
            stopRecording(true);
          }
        }, autoStopSilenceMs);
      };

      recognition.onerror = () => {
        setIsRecording(false);
        isRecordingRef.current = false;
        shouldKeepRecordingRef.current = false;
        onStatusRef.current?.('idle');
      };

      recognition.onend = () => {
        if (shouldKeepRecordingRef.current && !isPushToTalk) {
          try {
            recognition.start();
          } catch {
            setIsRecording(false);
            isRecordingRef.current = false;
            shouldKeepRecordingRef.current = false;
            onStatusRef.current?.('idle');
          }
          return;
        }
        setIsRecording(false);
        isRecordingRef.current = false;
        onStatusRef.current?.('idle');
      };

      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (silenceTimeoutRef.current) {
        window.clearTimeout(silenceTimeoutRef.current);
      }
      if (partialDebounceRef.current) {
        window.clearTimeout(partialDebounceRef.current);
      }
    };
  }, [autoStopSilenceMs, isPushToTalk]);

  useEffect(() => {
    if (isEnabled && autoSpeak && questionText && isSupported) {
      speakQuestion(questionText);
    }
  }, [questionText, isEnabled, autoSpeak, isSupported]);

  const speakQuestion = (text: string) => {
    if (!synthRef.current || !isSupported) return;
    
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onstart = () => {
      setIsSpeaking(true);
      onSpeechPlaybackStart?.();
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      onSpeechPlaybackEnd?.();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      onSpeechPlaybackEnd?.();
    };
    synthRef.current.speak(utterance);
  };

  const startRecording = () => {
    if (!isSupported || !recognitionRef.current) {
      toast({
        title: 'Voice not available',
        description: 'Speech recognition is not supported in your browser',
        variant: 'destructive',
      });
      return;
    }

    try {
      shouldKeepRecordingRef.current = true;
      recognitionRef.current.start();
      setIsRecording(true);
      isRecordingRef.current = true;
      onStatusRef.current?.('listening');
    } catch {
      setIsRecording(false);
      isRecordingRef.current = false;
      shouldKeepRecordingRef.current = false;
      onStatusRef.current?.('idle');
    }
  };

  const stopRecording = (silent = false) => {
    if (!recognitionRef.current) return;
    shouldKeepRecordingRef.current = false;
    recognitionRef.current.stop();
    setIsRecording(false);
    isRecordingRef.current = false;
    onStatusRef.current?.('idle');
    if (!silent) {
      toast({
        title: 'Recording stopped',
        description: 'Your answer chunks were captured.',
      });
    }
  };

  const handleRecordClick = () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    startRecording();
  };

  const toggleSpeech = () => {
    if (!synthRef.current || !isSupported) return;

    if (isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    } else {
      speakQuestion(questionText);
    }
  };

  if (!isEnabled) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-center">
        <Button
          onClick={handleRecordClick}
          onMouseDown={() => {
            if (isPushToTalk && !isRecording) startRecording();
          }}
          onMouseUp={() => {
            if (isPushToTalk && isRecordingRef.current) stopRecording(true);
          }}
          onMouseLeave={() => {
            if (isPushToTalk && isRecordingRef.current) stopRecording(true);
          }}
          variant={isRecording ? "destructive" : "outline"}
          size="icon"
          className={cn(
            "w-12 h-12 transition-all",
            isRecording && "ring-2 ring-red-500 ring-offset-2"
          )}
          disabled={!isSupported}
          title={isPushToTalk ? "Hold to talk" : (isRecording ? "Stop recording" : "Start recording")}
        >
          {isRecording ? (
            <MicOff className="h-5 w-5 animate-pulse" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
        
        <Button
          onClick={toggleSpeech}
          variant="outline"
          size="icon"
          className="w-12 h-12"
          disabled={!isSupported}
          title={isSpeaking ? "Stop speaking" : "Speak question"}
        >
          {isSpeaking ? (
            <VolumeX className="h-5 w-5 animate-pulse" />
          ) : (
            <Volume2 className="h-5 w-5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={cn("text-xs", isPushToTalk ? "text-primary" : "text-muted-foreground")}
          onClick={() => setIsPushToTalk(prev => !prev)}
        >
          {isPushToTalk ? 'Push-to-talk' : 'Toggle-listen'}
        </Button>
      </div>
      
      {!isSupported && (
        <p className="text-xs text-destructive">
          Voice not supported in your browser
        </p>
      )}
      
      {isSupported && (
        <p className="text-xs text-muted-foreground">
          {isPushToTalk 
            ? "Hold the mic button and speak your answer" 
            : isRecording 
              ? "🎤 Recording... Click to stop"
              : "Click mic to start recording your answer"
          }
        </p>
      )}
    </div>
  );
}

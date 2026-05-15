'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
  const [volume, setVolume] = useState(0);

  const recognitionRef = useRef<any>(null);
  const shouldKeepRecordingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const silenceTimeoutRef = useRef<number | null>(null);
  const partialDebounceRef = useRef<number | null>(null);
  const lastFinalRef = useRef('');
  const synthRef = useRef<SpeechSynthesis | null>(null);
  
  // Audio analysis refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const onPartialRef = useRef(onPartialTranscript);
  const onFinalRef = useRef(onFinalTranscript);
  const onStatusRef = useRef(onStatusChange);

  useEffect(() => {
    onPartialRef.current = onPartialTranscript;
    onFinalRef.current = onFinalTranscript;
    onStatusRef.current = onStatusChange;
  }, [onFinalTranscript, onPartialTranscript, onStatusChange]);

  // Handle Audio Context for Volume Visualization
  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        setVolume(average);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      
      updateVolume();
    } catch (err) {
      console.error('Error accessing microphone for analysis:', err);
    }
  };

  const stopAudioAnalysis = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setVolume(0);
  };

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
            }, 80); // Reduced debounce for better efficiency/responsiveness
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

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          handleRecordingEnd();
        }
      };

      recognition.onend = () => {
        if (shouldKeepRecordingRef.current && !isPushToTalk) {
          try {
            recognition.start();
          } catch {
            handleRecordingEnd();
          }
          return;
        }
        handleRecordingEnd();
      };

      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (synthRef.current) synthRef.current.cancel();
      stopAudioAnalysis();
      if (silenceTimeoutRef.current) window.clearTimeout(silenceTimeoutRef.current);
      if (partialDebounceRef.current) window.clearTimeout(partialDebounceRef.current);
    };
  }, [autoStopSilenceMs, isPushToTalk]);

  const handleRecordingEnd = () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    shouldKeepRecordingRef.current = false;
    onStatusRef.current?.('idle');
    stopAudioAnalysis();
  };

  useEffect(() => {
    if (isEnabled && autoSpeak && questionText && isSupported) {
      speakQuestion(questionText);
    }
  }, [questionText, isEnabled, autoSpeak, isSupported]);

  const speakQuestion = (text: string) => {
    if (!synthRef.current || !isSupported) return;
    
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

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

  const startRecording = async () => {
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
      startAudioAnalysis();
    } catch (err) {
      console.error('Failed to start recording:', err);
      handleRecordingEnd();
    }
  };

  const stopRecording = (silent = false) => {
    if (!recognitionRef.current) return;
    shouldKeepRecordingRef.current = false;
    recognitionRef.current.stop();
    handleRecordingEnd();
    if (!silent) {
      toast({
        title: 'Recording stopped',
        description: 'Your response has been captured.',
      });
    }
  };

  const handleRecordClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Keyboard support: Spacebar for push-to-talk or toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isRecording && isSupported && isEnabled) {
        // Prevent scrolling
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          startRecording();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isRecording && isPushToTalk) {
        stopRecording(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRecording, isPushToTalk, isSupported, isEnabled]);

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
    <div className="flex flex-col gap-4 p-4 rounded-xl border bg-card/50 backdrop-blur-sm shadow-sm transition-all hover:shadow-md">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-3 items-center">
          <div className="relative">
            {isRecording && (
              <div className="absolute -inset-2 bg-destructive/20 rounded-full animate-ping opacity-75" />
            )}
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
                "w-14 h-14 rounded-full transition-all duration-300 shadow-sm",
                isRecording ? "scale-110 shadow-destructive/20" : "hover:scale-105"
              )}
              disabled={!isSupported}
              title={isPushToTalk ? "Hold Space or click to talk" : (isRecording ? "Stop recording" : "Start recording")}
            >
              {isRecording ? (
                <MicOff className="h-6 w-6" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </Button>
          </div>
          
          <Button
            onClick={toggleSpeech}
            variant="outline"
            size="icon"
            className={cn(
              "w-12 h-12 rounded-full transition-all",
              isSpeaking && "border-primary text-primary"
            )}
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
            className={cn(
              "text-xs px-3 rounded-full border transition-colors", 
              isPushToTalk 
                ? "bg-primary/10 text-primary border-primary/20" 
                : "text-muted-foreground border-transparent"
            )}
            onClick={() => setIsPushToTalk(prev => !prev)}
          >
            {isPushToTalk ? 'Push-to-talk' : 'Toggle-listen'}
          </Button>
        </div>

        {/* Real-time Volume Visualizer */}
        {isRecording && (
          <div className="flex items-center gap-1 h-8 px-3 bg-muted/30 rounded-full">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-destructive rounded-full transition-all duration-75"
                style={{
                  height: `${Math.max(4, (volume / 255) * 100 * (0.5 + Math.random() * 0.5))}px`,
                  opacity: 0.3 + (volume / 255) * 0.7
                }}
              />
            ))}
          </div>
        )}
      </div>
      
      {!isSupported ? (
        <p className="text-xs text-destructive flex items-center gap-2 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
          Speech recognition is not supported in this browser.
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isRecording ? "bg-destructive animate-pulse" : "bg-muted"
          )} />
          <p className="text-xs text-muted-foreground font-medium">
            {isPushToTalk 
              ? "Hold Spacebar or the mic button to speak" 
              : isRecording 
                ? "Recording your answer... click to finish"
                : "Click the mic to start your response"
            }
          </p>
        </div>
      )}
    </div>
  );
}

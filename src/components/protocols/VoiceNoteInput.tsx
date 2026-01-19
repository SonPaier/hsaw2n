import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface VoiceNoteInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export const VoiceNoteInput = ({ onTranscript, disabled = false }: VoiceNoteInputProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startLiveRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast.error('Przeglądarka nie wspiera rozpoznawania mowy. Użyj Chrome lub Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pl-PL';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

    transcriptRef.current = '';
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsRecording(true);
      toast.info('Słucham... Kliknij ponownie aby zakończyć');
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      if (finalTranscript) {
        transcriptRef.current = finalTranscript.trim();
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      recognitionRef.current = null;
      setIsRecording(false);
      if (event.error === 'no-speech') {
        toast.error('Nie wykryto mowy. Spróbuj ponownie.');
      } else if (event.error === 'not-allowed') {
        toast.error('Brak dostępu do mikrofonu. Sprawdź uprawnienia.');
      } else if (event.error !== 'aborted') {
        toast.error('Błąd rozpoznawania mowy');
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsRecording(false);
      
      const transcript = transcriptRef.current;
      if (transcript) {
        onTranscript(transcript);
        toast.success('Tekst rozpoznany');
      }
    };

    recognition.start();
  }, [onTranscript]);

  const handleClick = () => {
    if (isRecording) {
      stopRecognition();
    } else {
      startLiveRecognition();
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleClick}
      disabled={disabled || isProcessing}
      className={`shrink-0 ${isRecording ? 'bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30' : 'bg-white'}`}
      title={isRecording ? 'Zatrzymaj nagrywanie' : 'Nagraj notatkę głosową'}
    >
      {isProcessing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isRecording ? (
        <MicOff className="w-4 h-4" />
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </Button>
  );
};

import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Service {
  id: string;
  name: string;
}

interface ParsedReservation {
  customerName?: string | null;
  phone?: string | null;
  carModel?: string | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  serviceName?: string | null;
  shouldConfirm?: boolean;
}

interface VoiceReservationInputProps {
  services: Service[];
  onParsed: (data: ParsedReservation) => void;
}

export const VoiceReservationInput = ({ services, onParsed }: VoiceReservationInputProps) => {
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

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      // First, transcribe the audio using Web Speech API or Whisper
      // For now, we'll use the browser's SpeechRecognition API
      const transcript = await transcribeWithBrowserAPI(audioBlob);
      
      if (!transcript) {
        toast.error('Nie rozpoznano mowy. Spróbuj ponownie.');
        return;
      }

      console.log('Transcript:', transcript);
      toast.info(`Rozpoznano: "${transcript}"`);

      // Parse the transcript with AI
      const { data, error } = await supabase.functions.invoke('parse-voice-reservation', {
        body: { 
          transcript,
          services: services.map(s => ({ id: s.id, name: s.name }))
        }
      });

      if (error) {
        console.error('Parse error:', error);
        toast.error('Błąd przetwarzania głosu');
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      console.log('Parsed data:', data);
      onParsed(data);
      toast.success('Dane wypełnione z nagrania');

    } catch (error) {
      console.error('Error processing audio:', error);
      toast.error('Błąd przetwarzania nagrania');
    } finally {
      setIsProcessing(false);
    }
  };

  const transcribeWithBrowserAPI = (audioBlob: Blob): Promise<string | null> => {
    return new Promise((resolve) => {
      // Check if SpeechRecognition is available
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        // Fallback: use audio as text prompt (not ideal but works)
        toast.error('Przeglądarka nie wspiera rozpoznawania mowy. Użyj Chrome lub Edge.');
        resolve(null);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'pl-PL';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        resolve(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        resolve(null);
      };

      recognition.onend = () => {
        // If no result was returned
      };

      // Play the audio to trigger recognition
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audio.play();
      recognition.start();

      // Timeout after 10 seconds
      setTimeout(() => {
        recognition.stop();
        resolve(null);
      }, 10000);
    });
  };

  // Use live recognition with manual stop support
  const startLiveRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast.error('Przeglądarka nie wspiera rozpoznawania mowy. Użyj Chrome lub Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pl-PL';
    recognition.interimResults = true; // Get interim results for better UX
    recognition.maxAlternatives = 1;
    recognition.continuous = true; // Keep listening until manually stopped

    transcriptRef.current = '';
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsRecording(true);
      toast.info('Słucham... Kliknij ponownie aby zakończyć');
    };

    recognition.onresult = (event: any) => {
      // Collect all results
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

    recognition.onend = async () => {
      recognitionRef.current = null;
      setIsRecording(false);
      
      const transcript = transcriptRef.current;
      if (!transcript) {
        return;
      }

      console.log('Final transcript:', transcript);
      toast.info(`Rozpoznano: "${transcript}"`);
      
      setIsProcessing(true);
      
      try {
        const { data, error } = await supabase.functions.invoke('parse-voice-reservation', {
          body: { 
            transcript,
            services: services.map(s => ({ id: s.id, name: s.name }))
          }
        });

        if (error) {
          console.error('Parse error:', error);
          toast.error('Błąd przetwarzania głosu');
          return;
        }

        if (data.error) {
          toast.error(data.error);
          return;
        }

        console.log('Parsed data:', data);
        onParsed(data);
        toast.success('Dane wypełnione z nagrania');
      } catch (error) {
        console.error('Error processing:', error);
        toast.error('Błąd przetwarzania');
      } finally {
        setIsProcessing(false);
      }
    };

    recognition.start();
  }, [services, onParsed]);

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
      disabled={isProcessing}
      className={isRecording ? 'bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30' : ''}
      title={isRecording ? 'Zatrzymaj nagrywanie' : 'Nagrywanie głosowe'}
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

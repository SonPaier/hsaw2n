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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });

      // Check for supported mime types
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        if (chunksRef.current.length === 0) {
          toast.error('Nie nagrano żadnego dźwięku');
          return;
        }

        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        await processAudio(audioBlob);
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      toast.info('Nagrywanie... Mów teraz');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Nie można uzyskać dostępu do mikrofonu');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
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

  // Alternative: Use live recognition instead of recording
  const startLiveRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast.error('Przeglądarka nie wspiera rozpoznawania mowy. Użyj Chrome lub Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pl-PL';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsRecording(true);
      toast.info('Słucham... Mów teraz');
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log('Live transcript:', transcript);
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

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      if (event.error === 'no-speech') {
        toast.error('Nie wykryto mowy. Spróbuj ponownie.');
      } else if (event.error === 'not-allowed') {
        toast.error('Brak dostępu do mikrofonu. Sprawdź uprawnienia.');
      } else {
        toast.error('Błąd rozpoznawania mowy');
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  }, [services, onParsed]);

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      // Use live recognition for better UX
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

import { useState, useCallback, useRef } from 'react';

export function useVoice(onTranscript: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const fullRef = useRef('');

  const start = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not supported. Try Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    fullRef.current = '';
    setIsRecording(true);

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          fullRef.current += result[0].transcript + ' ';
        } else {
          interim = result[0].transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = () => {
      stop();
    };

    recognition.onend = () => {
      if (recognitionRef.current) {
        const text = fullRef.current.trim();
        if (text.length > 3) onTranscript(text);
        setIsRecording(false);
        setInterimText('');
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [onTranscript]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    const text = fullRef.current.trim();
    if (text.length > 3) onTranscript(text);
    setIsRecording(false);
    setInterimText('');
    fullRef.current = '';
  }, [onTranscript]);

  const toggle = useCallback(() => {
    if (isRecording) stop();
    else start();
  }, [isRecording, start, stop]);

  return { isRecording, interimText, toggle, stop };
}

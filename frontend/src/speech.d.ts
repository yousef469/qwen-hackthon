interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: Event) => void;
  onend: () => void;
}

declare var SpeechRecognition: {
  new (): SpeechRecognition;
  prototype: SpeechRecognition;
};

interface Window {
  webkitSpeechRecognition: {
    new (): SpeechRecognition;
    prototype: SpeechRecognition;
  };
  SpeechRecognition: {
    new (): SpeechRecognition;
    prototype: SpeechRecognition;
  };
}

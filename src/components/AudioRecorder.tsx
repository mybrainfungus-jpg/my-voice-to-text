import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Square, AlertCircle, RefreshCw, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AudioRecorderProps {
  onTranscriptComplete: (text: string) => void;
}

export default function AudioRecorder({ onTranscriptComplete }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check Web Speech API support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => {
      setIsRecording(true);
      setError(null);
    };

    rec.onresult = (event: any) => {
      let finalStr = "";
      let interimStr = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalStr += event.results[i][0].transcript;
        } else {
          interimStr += event.results[i][0].transcript;
        }
      }

      if (finalStr) {
        setTranscript((prev) => {
          const combined = prev ? `${prev.trim()} ${finalStr.trim()}` : finalStr.trim();
          return combined;
        });
      }
      setInterimTranscript(interimStr);
    };

    rec.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setError("Microphone permission denied. Please allow microphone access in your browser settings.");
      } else if (event.error === "no-speech") {
        // Ignored since it's common if the user stays silent
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      setIsRecording(false);
    };

    rec.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = rec;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const startRecording = () => {
    if (!isSupported) {
      setError("Web Speech API is not supported in this browser. Please type your message below.");
      return;
    }

    try {
      setTranscript("");
      setInterimTranscript("");
      setError(null);
      recognitionRef.current.start();
    } catch (err: any) {
      console.error("Start recording failed:", err);
      setError("Failed to start voice-to-text. Please refresh and try again.");
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleClear = () => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  };

  const handleUseTranscript = () => {
    const finalText = `${transcript.trim()} ${interimTranscript.trim()}`.trim();
    if (finalText) {
      onTranscriptComplete(finalText);
    }
  };

  return (
    <div id="audio-recorder-container" className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-[#E6E0D9] flex-1 flex flex-col items-center justify-center text-center">
      <div className="mb-6">
        <span className="text-[#8BA88E] font-medium uppercase tracking-widest text-xs">Voice to Sheet AI</span>
        <h2 className="text-2xl md:text-3xl font-bold mt-2 text-[#2D2A26]">Capture your thought</h2>
        <p className="text-[#7D766F] mt-2 text-sm md:text-base">
          {isSupported
            ? "Tap the button below to start recording. Speak clearly into your mic."
            : "Live speech is not supported in this browser. You can type directly in the draft box!"}
        </p>
      </div>

      {/* Waveform Visualization */}
      <div className="flex items-center justify-center gap-1.5 h-16 mb-8 w-full max-w-xs">
        {isRecording ? (
          // Simulated active voice visualizer bars using framer motion loop
          Array.from({ length: 8 }).map((_, i) => {
            const heights = [24, 40, 56, 32, 48, 64, 40, 24];
            const delays = [0, 0.15, 0.3, 0.45, 0.2, 0.35, 0.1, 0.25];
            return (
              <motion.div
                key={i}
                className={`w-1.5 rounded-full ${i >= 2 && i <= 5 ? "bg-[#8BA88E]" : "bg-[#D9C5B2]"}`}
                animate={{
                  height: [heights[i] / 2, heights[i], heights[i] / 2],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: delays[i],
                }}
              />
            );
          })
        ) : (
          // Static visualizer bars
          <>
            <div className="w-1.5 h-6 bg-[#D9C5B2] rounded-full"></div>
            <div className="w-1.5 h-10 bg-[#D9C5B2] rounded-full"></div>
            <div className="w-1.5 h-14 bg-[#8BA88E] rounded-full opacity-40"></div>
            <div className="w-1.5 h-8 bg-[#8BA88E] rounded-full opacity-40"></div>
            <div className="w-1.5 h-12 bg-[#8BA88E] rounded-full opacity-40"></div>
            <div className="w-1.5 h-16 bg-[#8BA88E] rounded-full opacity-40"></div>
            <div className="w-1.5 h-10 bg-[#D9C5B2] rounded-full"></div>
            <div className="w-1.5 h-6 bg-[#D9C5B2] rounded-full"></div>
          </>
        )}
      </div>

      {/* Record Button */}
      <div className="relative mb-6">
        <AnimatePresence>
          {isRecording && (
            <motion.div
              className="absolute inset-0 bg-[#8BA88E]/20 rounded-full"
              initial={{ scale: 1 }}
              animate={{ scale: 1.4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          )}
        </AnimatePresence>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!isSupported}
          className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-lg transition-all focus:outline-none focus:ring-4 ${
            !isSupported
              ? "bg-[#E6E0D9] cursor-not-allowed text-[#7D766F]"
              : isRecording
              ? "bg-[#6A8B6D] hover:bg-[#5C7A5E] shadow-[#8BA88E]/30 focus:ring-[#8BA88E]/30"
              : "bg-[#8BA88E] hover:bg-[#7A997D] shadow-[#8BA88E]/30 focus:ring-[#8BA88E]/30"
          }`}
          aria-label={isRecording ? "Stop Recording" : "Start Recording"}
        >
          {isRecording ? (
            <Square className="w-8 h-8 text-white fill-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </button>
      </div>

      {/* Live Transcript Display Box */}
      <div className="w-full max-w-md bg-[#F9F6F2] border border-[#E6E0D9] rounded-2xl p-4 min-h-[100px] flex flex-col justify-between text-left mb-6">
        <div>
          <span className="text-[10px] font-bold text-[#7D766F] uppercase tracking-wider block mb-2">
            {isRecording ? "Listening..." : "Live Draft"}
          </span>
          <div className="text-[#2D2A26] text-sm leading-relaxed max-h-[140px] overflow-y-auto">
            {transcript || interimTranscript ? (
              <>
                <span>{transcript}</span>
                {interimTranscript && (
                  <span className="text-[#7D766F] italic"> {interimTranscript}</span>
                )}
              </>
            ) : (
              <span className="text-[#7D766F] italic text-xs">
                {isRecording ? "Say something..." : "No speech recorded yet. Use the mic to capture your thought."}
              </span>
            )}
          </div>
        </div>

        {(transcript || interimTranscript) && !isRecording && (
          <div className="flex gap-2 justify-end mt-4 pt-2 border-t border-[#E6E0D9]/60">
            <button
              onClick={handleClear}
              className="px-3 py-1 text-xs font-medium text-[#7D766F] hover:text-[#2D2A26] rounded transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Clear
            </button>
            <button
              onClick={handleUseTranscript}
              className="px-3 py-1 text-xs font-bold bg-[#8BA88E] text-white hover:bg-[#7A997D] rounded-lg transition-all flex items-center gap-1 shadow-sm"
            >
              <Sparkles className="w-3 h-3" /> Process Message
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs text-left max-w-md">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

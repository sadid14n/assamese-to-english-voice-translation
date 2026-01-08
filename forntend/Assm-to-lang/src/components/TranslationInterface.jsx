import { useRef, useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000/api/translate-audio";

export default function SimpleRecorder() {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [error, setError] = useState("");

  /* ---------------- START RECORDING ---------------- */
  const startRecording = async () => {
    try {
      setError("");
      setAudioUrl("");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: "audio/webm",
        });

        stream.getTracks().forEach((t) => t.stop());
        await sendAudioToBackend(audioBlob);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      setError("Microphone access denied");
    }
  };

  /* ---------------- STOP RECORDING ---------------- */
  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  /* ---------------- SEND AUDIO ---------------- */
  const sendAudioToBackend = async (blob) => {
    try {
      setIsProcessing(true);

      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      const response = await axios.post(API_URL, formData, {
        responseType: "blob",
      });

      const url = URL.createObjectURL(response.data);
      setAudioUrl(url);

      setTimeout(() => {
        audioRef.current?.play();
      }, 300);
    } catch (err) {
      console.error(err);
      setError("Failed to process audio");
    } finally {
      setIsProcessing(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <div style={{ maxWidth: 420, margin: "40px auto", textAlign: "center" }}>
      {/* <h2>🎙 Assamese → English Voice Translator</h2> */}

      {/* RECORD BUTTON */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          fontSize: 32,
          background: isRecording ? "#ef4444" : "#10b981",
          color: "#fff",
          border: "none",
          cursor: isProcessing ? "not-allowed" : "pointer",
          opacity: isProcessing ? 0.6 : 1,
        }}
      >
        {isRecording ? "■" : "🎙"}
      </button>

      {/* STATUS TEXT */}
      <p style={{ marginTop: 10 }}>
        {isRecording && "Recording..."}
        {!isRecording && isProcessing && "Processing audio... ⏳"}
        {!isRecording && !isProcessing && "Tap to record"}
      </p>

      {/* LOADING INDICATOR */}
      {isProcessing && (
        <div style={{ marginTop: 15 }}>
          <span>🔄 Please wait, translating voice...</span>
        </div>
      )}

      {/* ERROR */}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* AUDIO PLAYER (ONLY AFTER RESPONSE) */}
      {audioUrl && !isProcessing && (
        <audio
          ref={audioRef}
          src={audioUrl}
          controls
          style={{ marginTop: 20, width: "100%" }}
        />
      )}
    </div>
  );
}

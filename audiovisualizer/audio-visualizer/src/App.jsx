import React, { useRef, useState, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { useSpeechSynthesis } from "react-speech-kit";

export default function App() {
  const canvasRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const [consoleLog, setConsoleLog] = useState("");
  const [responseText, setResponseText] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const { speak, voices } = useSpeechSynthesis();
  const [isSpeaking, setIsSpeaking] = useState(false);

  const BACKEND_URL = "http://localhost:8000/upload_audio";

  // --- Google-style Visualizer Setup ---
  const drawVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    let animationFrameId;

    const draw = () => {
      if (!isSpeaking) {
        ctx.clearRect(0, 0, width, height);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      const dots = 24;
      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.18;

      for (let i = 0; i < dots; i++) {
        const angle = (i / dots) * Math.PI * 2;
        const pulse = Math.sin(Date.now() / 200 + i * 0.4) * 0.25 + 0.75;
        const r = baseRadius * (1 + pulse * 0.4);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        const hue = (i * (360 / dots) + Date.now() / 20) % 360;
        const size = 6 + pulse * 10;

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${hue}, 90%, 60%)`;
        ctx.shadowBlur = 30;
        ctx.shadowColor = `hsl(${hue}, 90%, 60%)`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationFrameId);
  };

  useEffect(() => {
    if (isSpeaking) {
      drawVisualizer();
    }
  }, [isSpeaking]);

  // --- Request Microphone Permission ---
  const requestPermission = async () => {
    try {
      console.log("Requesting microphone permission...");
      setConsoleLog("Requesting microphone permission...");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionError(false);
      setConsoleLog("✅ Microphone permission granted");
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (err) {
      console.error("❌ Microphone permission denied:", err);
      setConsoleLog("❌ Microphone permission denied");
      setPermissionError(true);
      return false;
    }
  };

  // --- Start Recording ---
  const startMic = async () => {
    const permissionGranted = await requestPermission();
    if (!permissionGranted) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setListening(true);

      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", blob, "recording.webm");

        setConsoleLog("🎙️ Sending audio to backend...");

        try {
          const res = await fetch(BACKEND_URL, { method: "POST", body: formData });
          const data = await res.json();
          console.log("✅ Server response:", data);

          if (data.response) {
            setResponseText(data.response);
         

            // Speak AI response
            const voice = voices.find((v) => v.lang.startsWith("en")) || voices[0];
            setIsSpeaking(true);
            speak({
              text: data.response,
              voice,
              rate: 1,
              pitch: 1,
              onend: () => {
                setIsSpeaking(false);
              },
            });
          }
        } catch (err) {
          console.error("❌ Upload failed:", err);
     
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setConsoleLog("🎧 Recording started...");
    } catch (err) {
      console.error("❌ Error starting microphone:", err);
      setConsoleLog("❌ Error starting microphone");
    }
  };

  // --- Stop Recording ---
  const stopMic = () => {
    setListening(false);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setConsoleLog("⏹️ Recording stopped");
    }
  };

  useEffect(() => {
    requestPermission();
  }, []);

  return (
    <div style={{ backgroundColor: "#000", color: "#fff"}}>
    <div
      style={{
        background: "#000000ff",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        color: "white",
      }}
    >
      {/* Google-style Visualizer */}
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 1,
          bottom: 0,
          right: 0,
          background: "#050608",
        }}
      />

      {/* Mic Button */}
      <button
        onClick={listening ? stopMic : startMic}
        style={{
          background: listening ? "#ff4b4b" : "#0077ff",
          border: "none",
          borderRadius: "50%",
          width: "80px",
          height: "80px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          boxShadow: "0 0 25px rgba(0,0,0,0.3)",
          cursor: "pointer",
          transition: "all 0.3s ease",
          zIndex: 10,
        }}
      >
        {listening ? <MicOff size={36} color="white" /> : <Mic size={36} color="white" />}
      </button>

     

      {/* Permission Error */}
      {permissionError && (
        <p
          style={{
            marginTop: "20px",
            color: "#ff5555",
            fontSize: "15px",
            textAlign: "center",
            maxWidth: "300px",
          }}
        >
          ⚠️ Please allow microphone access in System Settings → Privacy & Security → Microphone.
        </p>
      )}
    </div>
        </div>
  );
}

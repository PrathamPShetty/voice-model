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

  const BACKEND_URL = "http://172.16.3.154:8000/upload_audio";

  // --- 🎵 Visualizer ---
  const drawVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    let animationFrameId;

    const draw = () => {
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
    if (isSpeaking) drawVisualizer();
  }, [isSpeaking]);

  // --- 🎙️ Request mic permission ---
  const requestPermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionError(false);
    } catch (err) {
      console.error("Mic permission denied:", err);
      setPermissionError(true);
    }
  };

  // --- 🎤 Start Recording ---
const startMic = async () => {
  setListening(true);
  setConsoleLog("🎙️ Listening...");

  try {
    // 🔹 Call your backend (no audio sent)
    const res = await fetch(BACKEND_URL, { method: "POST" });
    const data = await res.json();

    console.log("✅ Backend response received:", data);

    if (data.response) {
      const voice = voices.find((v) => v.lang.startsWith("en")) || voices[0];
      setIsSpeaking(true);

      speak({
        text: data.response,
        voice,
        rate: 1,
        pitch: 1,
        onend: () => {
          setIsSpeaking(false);
          setListening(false);
        },
      });

      setResponseText(data.response);
    } else {
      setConsoleLog("⚠️ No response from backend.");
    }
  } catch (err) {
    console.error("❌ Upload failed:", err);
    setConsoleLog("❌ Failed to contact backend.");
  }
};


  // --- ⏹️ Stop Recording ---
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
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh" }}>
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 1,
          background: "#050608",
        }}
      />

      {/* 🎤 Mic Button */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <button
          onClick={listening ? stopMic : startMic}
          style={{
            background: listening ? "#ff4b4b" : "#0077ff",
            border: "none",
            borderRadius: "50%",
            width: "90px",
            height: "90px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            boxShadow: "0 0 25px rgba(255,255,255,0.2)",
            cursor: "pointer",
            transition: "all 0.3s ease",
          }}
        >
          {listening ? <MicOff size={40} color="white" /> : <Mic size={40} color="white" />}
        </button>

  
      </div>
    </div>
  );
}

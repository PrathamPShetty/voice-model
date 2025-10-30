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

  const BACKEND_URL = "http://backend:8000/upload_audio"; // 🔁 change to your backend API

  // --- 🎵 Visualizer ---
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
        animationFrameId = requestAnimationFrame(draw);
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

  // --- 🎙️ Welcome Message ---
  const starting = () => {
    if (!isSpeaking && !listening) {
      const voice = voices.find((v) => v.lang.startsWith("en")) || voices[0];
      setIsSpeaking(true);
      speak({
        text: "Welcome to Envision Junior. If you need any assistance, please tap the microphone button and ask your question.",
        voice,
        rate: 1,
        pitch: 1,
        onend: () => setIsSpeaking(false),
      });
    }
  };

  useEffect(() => {
    starting();
  }, []);

  useEffect(() => {
    starting();
    if (isSpeaking) drawVisualizer();
  }, [isSpeaking]);

  // --- 🔐 Request Mic Permission ---
  const requestPermission = async () => {
    try {
      console.log("Requesting microphone permission...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionError(false);
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (err) {
      console.error("❌ Microphone permission denied:", err);
      setPermissionError(true);
      return false;
    }
  };

  // --- 🎧 Start Recording ---
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

          if (data.response) {
            setResponseText(data.response);

            const voice = voices.find((v) => v.lang.startsWith("en")) || voices[0];
            setIsSpeaking(true);
            speak({
              text: data.response,
              voice,
              rate: 1,
              pitch: 1,
              onend: () => setIsSpeaking(false),
            });
          }
        } catch (err) {
          console.error("❌ Upload failed:", err);
          setResponseText("Sorry, I couldn’t process your question.");
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

      

        {/* ⚠️ Permission Error */}
        {permissionError && (
          <p
            style={{
              color: "#ff5555",
              textAlign: "center",
              marginTop: "20px",
            }}
          >
            ⚠️ Please allow microphone access in your browser or device settings.
          </p>
        )}

        {/* 🧾 Console Log */}
        {/* <small style={{ color: "#aaa", marginTop: "10px" }}>{consoleLog}</small> */}
      </div>
    </div>
  );
}

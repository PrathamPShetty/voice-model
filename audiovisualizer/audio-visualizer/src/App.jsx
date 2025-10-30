import React, { useRef, useEffect, useState } from "react";
import { Mic, MicOff } from "lucide-react";

export default function App() {
  const canvasRef = useRef(null);
  const [listening, setListening] = useState(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      setListening(true);
      animateDots();
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  };

  const stopMic = () => {
    setListening(false);
    if (sourceRef.current) sourceRef.current.disconnect();
    if (analyserRef.current) analyserRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    cancelAnimationFrame(animationRef.current);
  };

  const animateDots = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let WIDTH = (canvas.width = window.innerWidth);
    let HEIGHT = (canvas.height = window.innerHeight);
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;

    const totalDots = 25;
    const dots = Array.from({ length: totalDots }, (_, i) => ({
      angle: (i / totalDots) * Math.PI * 2,
      baseRadius: 50 + Math.random() * 40,
      size: 3 + Math.random() * 5,
      hue: 200 + Math.random() * 160,
      speed: 0.6 + Math.random() * 1.0,
      orbitOffset: Math.random() * Math.PI * 2,
    }));

    const analyser = analyserRef.current;

    const render = () => {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const beat = avg / 3.5;

      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      dots.forEach((dot) => {
        dot.angle += 0.008 * dot.speed;
        const radius =
          dot.baseRadius + Math.sin(Date.now() / 300 + dot.orbitOffset) * 10 + beat * 1.3;
        const x = centerX + Math.cos(dot.angle) * radius;
        const y = centerY + Math.sin(dot.angle) * radius;

        const color = `hsl(${dot.hue + beat * 2}, 90%, 45%)`;

        ctx.beginPath();
        ctx.arc(x, y, dot.size + beat / 15, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowBlur = 20 + beat / 2;
        ctx.shadowColor = color;
        ctx.fill();
      });

      ctx.beginPath();
      ctx.arc(centerX, centerY, 50 + beat * 0.8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(66,133,244,${0.25 + beat / 120})`;
      ctx.lineWidth = 2 + beat / 10;
      ctx.stroke();

      animationRef.current = requestAnimationFrame(render);
    };

    render();
  };

  useEffect(() => {
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

return (
  <div
    style={{
      background: "white",
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
      position: "relative", // important for perfect centering
    }}
  >
    {/* Animated dots canvas */}
    <canvas
      ref={canvasRef}
      width={window.innerWidth}
      height={window.innerHeight}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        background: "white",
      }}
    />

    {/* Centered mic container */}
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)", // perfect center
        zIndex: 2,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <button
        onClick={listening ? stopMic : startMic}
        style={{
          background: listening ? "#ff4b4b" : "#4285F4",
          border: "none",
          borderRadius: "50%",
          width: "65px",
          height: "65px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
          cursor: "pointer",
          transition: "all 0.3s ease",
        }}
      >
        {listening ? (
          <MicOff size={32} color="white" />
        ) : (
          <Mic size={32} color="white" />
        )}
      </button>
    </div>
  </div>
);

}

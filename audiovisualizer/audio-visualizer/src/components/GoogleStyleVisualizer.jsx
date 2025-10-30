import React, { useRef, useEffect, useState } from "react";

/**
 * GoogleStyleVisualizer.jsx
 * Responsive canvas, HiDPI support, Web Audio API analyser, glowing dots
 */

export default function GoogleStyleVisualizer() {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  const [audioSrc, setAudioSrc] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAudioSrc(url);
  };

  // Setup and connect audio context on first user gesture
  const ensureAudio = () => {
    if (audioCtxRef.current) return;

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    // createMediaElementSource must be called with an <audio> element
    const source = ctx.createMediaElementSource(audioRef.current);
    source.connect(analyser);
    analyser.connect(ctx.destination);

    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
  };

  // Resize canvas for responsiveness & high DPI
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(300, Math.floor(rect.width * dpr));
    canvas.height = Math.max(150, Math.floor(rect.height * dpr * 0.6)); // keep ratio
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${Math.floor(rect.height * 0.6)}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // normalize drawing scale
  };

  useEffect(() => {
    // initial resize and on window resize
    resizeCanvas();
    const onResize = () => {
      cancelAnimationFrame(rafRef.current);
      resizeCanvas();
      if (isPlaying) startRendering(); // restart render loop
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
      // close audio context on unmount (optional)
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw loop
  const startRendering = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const analyser = analyserRef.current;
    if (!canvas || !ctx || !analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      analyser.getByteFrequencyData(dataArray);
      // clear with subtle background
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // compute layout in CSS pixels
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const cx = width / 2;
      const cy = height / 2;
      const dots = Math.max(14, Math.floor(width / 18)); // responsive number of dots
      const baseRadius = Math.min(width, height) * 0.18;

      // background radial vignette
      const gradient = ctx.createRadialGradient(cx, cy, baseRadius * 0.3, cx, cy, Math.max(width, height));
      gradient.addColorStop(0, "rgba(10, 10, 12, 0.18)");
      gradient.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // draw glowing dots
      for (let i = 0; i < dots; i++) {
        const angle = (i / dots) * Math.PI * 2;
        const idx = Math.floor((i / dots) * bufferLength);
        const amplitude = dataArray[idx] / 255; // 0..1
        const pulse = Math.sin((Date.now() / 600) + i * 0.3) * 0.06; // gentle motion

        const r = baseRadius * (1 + amplitude * 0.9 + pulse);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        const hue = Math.floor((i * (360 / dots) + amplitude * 120) % 360);
        const sat = 90;
        const light = 55 + amplitude * 10;

        const color = `hsl(${hue}deg ${sat}% ${light}%)`;
        const size = Math.max(4, 6 + amplitude * 18);

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        // soft glow
        ctx.fillStyle = color;
        ctx.shadowBlur = 18 + amplitude * 40;
        ctx.shadowColor = color;
        ctx.fill();

        // subtle inner highlight
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, size * 0.35), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.08 + amplitude * 0.12})`;
        ctx.shadowBlur = 0;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(render);
    };

    // start loop
    cancelAnimationFrame(rafRef.current);
    render();
  };

  const stopRendering = () => {
    cancelAnimationFrame(rafRef.current);
  };

  // Play/pause handler
  const handlePlayPause = async () => {
    if (!audioSrc) return alert("Please choose an audio file first.");

    // ensure ctx exists and resume if needed
    ensureAudio();
    const ctx = audioCtxRef.current;

    // On many browsers, audioContext must be resumed after a user gesture
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    if (audioRef.current.paused) {
      try {
        await audioRef.current.play();
      } catch (err) {
        console.warn("Audio playback failed:", err);
        return;
      }
      setIsPlaying(true);
      startRendering();
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
      stopRendering();
    }
  };

  // When audio ends: stop visualizer
  useEffect(() => {
    const aud = audioRef.current;
    if (!aud) return;
    const onEnded = () => {
      setIsPlaying(false);
      stopRendering();
    };
    aud.addEventListener("ended", onEnded);
    return () => aud.removeEventListener("ended", onEnded);
  }, []);

  // When audio source changes, ensure context is reconnected — if audio element exists and ctx not set, do nothing; ensureAudio will be called on play.
  useEffect(() => {
    // initial sizing for container height
    const parent = canvasRef.current?.parentElement;
    if (parent) {
      parent.style.minHeight = "220px";
    }
  }, []);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 18,
      width: "100%",
      padding: 18,
      boxSizing: "border-box",
      background: "#050608",
      minHeight: "60vh"
    }}>
      <div style={{
        width: "100%",
        maxWidth: 900,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12
      }}>
        <div style={{ width: "100%" }}>
          <canvas
            ref={canvasRef}
            style={{
              width: "100%",
              height: "220px",
              borderRadius: 14,
              display: "block",
              background: "transparent",
              boxShadow: "0 10px 40px rgba(0,0,0,0.6)"
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="file" accept="audio/*" onChange={handleFileChange} />
          <button onClick={handlePlayPause} style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            background: "linear-gradient(90deg,#00e6a8,#0077ff)",
            color: "white",
            fontWeight: 700
          }}>
            {isPlaying ? "Pause" : "Play"}
          </button>
          {audioSrc && <span style={{ color: "#bbb", fontSize: 13 }}>Loaded</span>}
        </div>
      </div>

      <audio ref={audioRef} src={audioSrc || ""} style={{ display: "none" }} crossOrigin="anonymous" />
    </div>
  );
}

import os
import tempfile
import subprocess
import whisper
import pyttsx3
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from langchain_ollama import OllamaLLM

# === FastAPI setup ===
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # you can restrict this to your frontend domain later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Initialize Models ===
stt_model = whisper.load_model("base")  # Speech-to-text model
tts_engine = pyttsx3.init()             # Text-to-speech engine
llm = OllamaLLM(model="llama3.2:3b", base_url="http://localhost:11434")  # Local Llama model

# === API Route ===
@app.post("/upload_audio")
async def upload_audio(file: UploadFile = File(...)):
    try:
        # Step 1: Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_webm:
            temp_webm.write(await file.read())
            temp_webm_path = temp_webm.name

        # Step 2: Convert WebM → WAV using ffmpeg
        wav_path = temp_webm_path.replace(".webm", ".wav")
        command = [
            "ffmpeg",
            "-y",  # overwrite if exists
            "-i", temp_webm_path,
            "-ar", "16000",  # 16 kHz sample rate
            "-ac", "1",      # mono channel
            wav_path
        ]
        subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

        # Step 3: Transcribe with Whisper
        result = stt_model.transcribe(wav_path)
        query = result["text"].strip()
        print(f"👤 User said: {query}")

        # Step 4: Generate AI response with Llama (LangChain Ollama)
        response = llm.invoke(query)
        print(f"🧠 Model response: {response}")



        # Step 6: Cleanup temp files
        os.remove(temp_webm_path)
        os.remove(wav_path)

        # Step 7: Return JSON to frontend
        return {"response": response }

    except subprocess.CalledProcessError as ffmpeg_error:
        print("❌ FFmpeg conversion failed:", ffmpeg_error.stderr.decode())
        return {"error": "FFmpeg failed to convert audio"}

    except Exception as e:
        print("❌ Error:", e)
        return {"error": str(e)}

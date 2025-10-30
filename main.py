import sounddevice as sd
import numpy as np
import soundfile as sf
import whisper
import pyttsx3
from langchain_ollama import OllamaLLM
from langgraph.graph import StateGraph
from typing import Annotated
from typing_extensions import TypedDict


# === Voice + Models ===
stt_model = whisper.load_model("base")
tts_engine = pyttsx3.init()
llm = OllamaLLM(model="llama3.2:3b", base_url="http://localhost:11434")


# === Define Graph State ===
class ConversationState(TypedDict, total=False):
    audio_path: str
    query: str
    response: str
    stop: bool


# === Node 1: Record Audio ===
def record_audio_node(state: ConversationState) -> ConversationState:
    print("🎙️ Speak now...")
    samplerate = 16000
    duration = 5
    sd.default.device = (0, 1)
    audio = sd.rec(int(duration * samplerate), samplerate=samplerate, channels=1)
    sd.wait()
    sf.write("temp.wav", audio, samplerate)
    return {"audio_path": "temp.wav"}


# === Node 2: Speech-to-Text ===
def speech_to_text_node(state: ConversationState) -> ConversationState:
    audio_path = state["audio_path"]
    result = stt_model.transcribe(audio_path)
    text = result["text"].strip()
    print("👤 You:", text)
    return {"query": text}


# === Node 3: Chat with Model (LLM) ===
def chat_node(state: ConversationState) -> ConversationState:
    query = state["query"]
    if "stop" in query.lower():
        return {"response": "Goodbye!", "stop": True}
    response = llm.invoke(query)
    return {"response": response, "stop": False}


# === Node 4: Speak Response ===
def speak_text_node(state: ConversationState) -> ConversationState:
    text = state["response"]
    print("🗣️", text)
    tts_engine.say(text)
    tts_engine.runAndWait()
    return state


# === Build Graph ===
graph = StateGraph(ConversationState)

graph.add_node("record_audio", record_audio_node)
graph.add_node("speech_to_text", speech_to_text_node)
graph.add_node("chat", chat_node)
graph.add_node("speak_text", speak_text_node)

graph.add_edge("record_audio", "speech_to_text")
graph.add_edge("speech_to_text", "chat")
graph.add_edge("chat", "speak_text")

graph.set_entry_point("record_audio")

# Compile graph into a runnable app
app = graph.compile()


# === Run Loop ===
if __name__ == "__main__":
    tts_engine.say("Hello! How can I help you?")
    tts_engine.runAndWait()

    while True:
        state = {}
        state = app.invoke(state)
        if state.get("stop"):
            speak_text_node(state)
            break

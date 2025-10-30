import os
import tempfile
import subprocess
import whisper
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from langchain_core.prompts import PromptTemplate
from langchain_classic.chains import RetrievalQA
from langchain_community.document_loaders import TextLoader
from langchain_community.vectorstores import FAISS
from langchain_classic.text_splitter import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaLLM, OllamaEmbeddings


os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"



# === FastAPI setup ===
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Load Whisper (Speech-to-Text) ===
print("🎧 Loading Whisper model...")
stt_model = whisper.load_model("base")

# === Load Srinivas Institute Data ===
print("📄 Loading Srinivas data...")
if not os.path.exists("srinivas_data.txt"):
    raise FileNotFoundError("❌ srinivas_data.txt not found! Please place it in the project root.")

loader = TextLoader("srinivas_data.txt")
docs = loader.load()

# === Split data into manageable chunks ===
print("✂️ Splitting text into chunks...")
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
splits = text_splitter.split_documents(docs)

# === Create embeddings using Ollama ===
print("🔢 Creating embeddings (Llama3.2:3b)...")
embeddings = OllamaEmbeddings(model="llama3.2:3b", base_url="http://localhost:11434")

# === Build FAISS Vector Database ===
print("📚 Creating FAISS vector database...")
vectordb = FAISS.from_documents(splits, embedding=embeddings)
vectordb.save_local("college_faiss_index")

# === Initialize Ollama LLM ===
print("🧠 Loading Ollama model...")
llm = OllamaLLM(model="llama3.2:3b", base_url="http://localhost:11434")

# === Define custom prompt ===
template = """
You are Envision Junior, a voice assistant for Srinivas Institute of Technology (SIT).
Answer questions using the provided context accurately and politely.
If the question is unrelated to SIT or its departments, reply as a general AI assistant.

Context:
{context}

Question:
{question}
"""

prompt = PromptTemplate(template=template, input_variables=["context", "question"])

# === Create Retrieval QA Chain ===
print("⚙️ Setting up Retrieval-Augmented Generation chain...")
qa = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=vectordb.as_retriever(search_kwargs={"k": 3}),
    chain_type_kwargs={"prompt": prompt},
)

# === FastAPI route for voice input ===
@app.post("/upload_audio")
async def upload_audio(file: UploadFile = File(...)):
    try:
        # Step 1: Save uploaded audio temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_webm:
            temp_webm.write(await file.read())
            temp_webm_path = temp_webm.name

        # Step 2: Convert .webm → .wav using ffmpeg
        wav_path = temp_webm_path.replace(".webm", ".wav")
        command = [
            "ffmpeg", "-y",
            "-i", temp_webm_path,
            "-ar", "16000",  # sample rate
            "-ac", "1",      # mono
            wav_path
        ]
        subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

        # Step 3: Transcribe audio using Whisper
        result = stt_model.transcribe(wav_path)
        query = result["text"].strip()
        print(f"🎙️ User said: {query}")

        # Step 4: Query RAG system
        rag_response = qa.invoke({"query": query})
        response = rag_response["result"]
        print(f"🧠 Model (RAG) Response: {response}")

        # Fallback: If no relevant context found, answer generally
        if "don't know" in response.lower() or "not sure" in response.lower():
            response = llm.invoke(query)

        # Step 5: Clean up temporary files
        os.remove(temp_webm_path)
        os.remove(wav_path)

        # Step 6: Send back response
        return {"query": query, "response": response}

    except subprocess.CalledProcessError as ffmpeg_error:
        print("❌ FFmpeg conversion failed:", ffmpeg_error.stderr.decode())
        return {"error": "FFmpeg failed to convert audio"}

    except Exception as e:
        print("❌ Error:", e)
        return {"error": str(e)}

# === Run command ===
# uvicorn main:app --reload

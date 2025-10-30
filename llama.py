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
# print("📄 Loading Srinivas data...")
# if not os.path.exists("srinivas_data.txt"):
#     raise FileNotFoundError("❌ srinivas_data.txt not found! Please place it in the project root.")

# loader = TextLoader("srinivas_data.txt")
# docs = loader.load()

# === Split data into manageable chunks ===
# print("✂️ Splitting text into chunks...")
# text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
# splits = text_splitter.split_documents(docs)

# === Create embeddings using Ollama ===
# print("🔢 Creating embeddings (Llama3.2:3b)...")
# embeddings = OllamaEmbeddings(model="llama3.2:3b", base_url="http://localhost:11434")

# === Build FAISS Vector Database ===
# print("📚 Creating FAISS vector database...")
# vectordb = FAISS.from_documents(splits, embedding=embeddings)
# vectordb.save_local("college_faiss_index")

# === Initialize Ollama LLM ===
print("🧠 Loading Ollama model...")
llm = OllamaLLM(model="llama3.2:3b", base_url="http://localhost:11434")

# === Define custom prompt ===
template = """
You are Envision Junior, a voice assistant for Srinivas Institute of Technology (SIT).
Answer questions using the provided context accurately and politely.
If the question is unrelated to SIT or its departments, reply as a general AI assistant.


The Srinivas Group of Colleges was the dream of an ideal teacher, A. Shama Rao, and was brought to reality by his noble son, CA A. Raghavendra Rao. The A. Shama Rao Foundation, named after the great visionary, was established by Dr. Rao in 1988 with the goal of providing quality education and fostering ethical, responsible citizens.

Education at Srinivas institutions goes beyond imparting knowledge — it aims to nurture moral and ethical values in students, enabling them to apply their learning constructively.
Today, the Srinivas Group educates over 12,000 students across 18 colleges, located on three campuses — Pandeshwar, Valachil, and Mukka. Each institution is supported by a team of highly qualified faculty and dedicated support staff, ensuring holistic development and academic excellence.
 Srinivas Institute of Technology (SIT), Mangaluru

Srinivas Institute of Technology (SIT), located in Valachil, Mangaluru, is a premier engineering institution established in 2006. It is affiliated with Visvesvaraya Technological University (VTU), Belagavi, and is part of the Srinivas Group of Institutions, founded by Dr. CA A. Raghavendra Rao under the A. Shama Rao Foundation.

Over the years, SIT has grown into one of the most highly regarded self-financed engineering colleges in the region, currently hosting more than 13,000 students pursuing higher education. The institution is known for its focus on innovation, research, and industry-oriented learning.
 Proud Achievement

Srinivas Institute of Technology has been awarded an ‘A’ Grade in the Second Cycle of NAAC Accreditation — a recognition of its commitment to academic excellence, innovation, and holistic growth.
This achievement reflects the collective efforts of the management, faculty, students, alumni, parents, recruiters, and well-wishers. Together, the SIT community continues to set new benchmarks in quality education and sustainable development.

Academic Programs
Undergraduate Programs (B.E.)

Computer Science and Engineering (CSE)

Computer Science and Design (CSD)

Computer Science and Business Systems (CSBS)

Electronics and Communication Engineering (ECE)

Mechanical Engineering (ME)

Information Science and Engineering (ISE)

Electrical and Electronics Engineering (EEE)

Aeronautical Engineering

Automobile Engineering

Marine Engineering

Artificial Intelligence and Machine Learning (AIML)

Artificial Intelligence and Data Science (AIDS)

Undergraduate Program – Architecture

Bachelor of Architecture (B.Arch)

Postgraduate Programs

Master of Business Administration (MBA)

Master of Computer Applications (MCA)

M.Tech in Computer Science and Engineering

M.Tech in Industrial Automation and Robotics

M.Tech in Digital Electronics

 Institutional Ethos

SIT aims to create a vibrant learning environment where innovation, research, ethics, and leadership form the core values. The institution emphasizes industry collaboration, placements, entrepreneurship, and community development — nurturing students to become globally competent professionals.

Training and Placement Officer

Dr. Dheeraj Hebri, MCA, Ph.D
Training and Placement Officer, Srinivas Institute of Technology


Department of Aeronautical Engineering
Sl. No.	Name of the Faculty	Designation	Qualification
1	Dr. Praveen Shenoy	Assistant Professor	B.E., M.Tech, Ph.D
2	Dr. Gangadhara Rao	Professor	B.E., M.Tech, Ph.D
3	Mr. P. Ramesh Kumar	Professor	B.E., M.Tech
4	Dr. Lokesh K. S.	Assistant Professor	B.E., M.Tech, (Ph.D)
5	Dr. Rajesh	Assistant Professor	B.E., M.Tech, Ph.D
6	Mr. Jagadeesh B	Assistant Professor	B.E., M.Tech
7	Ms. Srinidhi Kukkila	Assistant Professor	B.E., M.Tech, MBA

Department of Artificial Intelligence and Machine Learning
Sl. No.	Name of the Faculty	Designation	Qualification
1	Mrs. Daya Naik	Professor & Head of Department (In-Charge)	B.E., M.Tech
2	Dr. Parvathraj K. M. M.	Associate Professor	B.E., M.Tech, Ph.D
3	Mr. Ganesh M. S.	Assistant Professor	B.E., M.Tech
4	Mr. Nivin	Assistant Professor	B.E., M.Tech, Diploma
5	Mrs. Nithya B. P.	Assistant Professor	B.E., M.Tech
6	Mr. Madhusudhan S.	Assistant Professor	B.E., M.Tech (Best Teacher Award 2022–23)


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

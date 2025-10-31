import os
import tempfile
import subprocess
import whisper
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from langchain_core.prompts import PromptTemplate
from langchain_classic.chains import LLMChain
from langchain_ollama import OllamaLLM

# === FastAPI setup ===
app = FastAPI()


orgins = [
    "https://katcon.registration.envisionsit.com",
    "https://kitcon.backend.envisionsit.com",
    "http://katcon.registration.envisionsit.com",
    "http:localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=orgins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Load Whisper (Speech-to-Text) ===
print("🎧 Loading Whisper model...")
stt_model = whisper.load_model("base")

# === Load Ollama model ===
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
template2 = """
You are a grammar correction and information-enhancement assistant for Srinivas Institute of Technology (SIT), Mangaluru.

Your responsibilities:
1. Correct grammar and spelling mistakes in the provided text.
2. Fix any misspellings or variations of the name “Srinivas Institute of Technology” 
   (e.g., “Shinwas”, “Srinivaas”, “Srinivas collage”, etc.) and ensure it’s correctly written.
3. Maintain the original tone and style of the user’s input.
4. Use the provided context about Srinivas Institute of Technology (SIT) to make the response 
   informative and relevant.
5. If the question relates to SIT, include accurate and verified information about:
   - Location (Valachil, Mangaluru)
   - Founder (Dr. CA A. Raghavendra Rao, under A. Shama Rao Foundation)
   - Courses and academic programs
   - Departments and faculty
   - Facilities and infrastructure
   - Placements and industry collaborations
   - Extracurricular activities and student life
   - Institutional ethos and values
6. If the question is unrelated to SIT, only correct grammar and tone — do not add new details.

Context:
{context}

Question or Text to Correct:
{question}
"""


prompt = PromptTemplate(template=template, input_variables=["context", "question"])
prompt2 = PromptTemplate(template=template2, input_variables=["context", "question"])

qa = LLMChain(llm=llm, prompt=prompt)
qa2 = LLMChain(llm=llm, prompt=prompt2)



SIT_CONTEXT_TEXT = """The Srinivas Group of Colleges was the dream of an ideal teacher, A. Shama Rao, and was brought to reality by his noble son, CA A. Raghavendra Rao. The A. Shama Rao Foundation, named after the great visionary, was established by Dr. Rao in 1988 with the goal of providing quality education and fostering ethical, responsible citizens.

Education at Srinivas institutions goes beyond imparting knowledge — it aims to nurture moral and ethical values in students, enabling them to apply their learning constructively.
Today, the Srinivas Group educates over 12,000 students across 18 colleges, located on three campuses — Pandeshwar, Valachil, and Mukka. Each institution is supported by a team of highly qualified faculty and dedicated support staff, ensuring holistic development and academic excellence.

Srinivas Institute of Technology (SIT), located in Valachil, Mangaluru, is a premier engineering institution established in 2006. It is affiliated with Visvesvaraya Technological University (VTU), Belagavi, and is part of the Srinivas Group of Institutions, founded by Dr. CA A. Raghavendra Rao under the A. Shama Rao Foundation.

Over the years, SIT has grown into one of the most highly regarded self-financed engineering colleges in the region, currently hosting more than 13,000 students pursuing higher education. The institution is known for its focus on innovation, research, and industry-oriented learning.

Srinivas Institute of Technology has been awarded an ‘A’ Grade in the Second Cycle of NAAC Accreditation — a recognition of its commitment to academic excellence, innovation, and holistic growth.
This achievement reflects the collective efforts of the management, faculty, students, alumni, parents, recruiters, and well-wishers. Together, the SIT community continues to set new benchmarks in quality education and sustainable development.

Academic Programs
Undergraduate Programs (B.E.)
- Computer Science and Engineering (CSE)
- Computer Science and Design (CSD)
- Computer Science and Business Systems (CSBS)
- Electronics and Communication Engineering (ECE)
- Mechanical Engineering (ME)
- Information Science and Engineering (ISE)
- Electrical and Electronics Engineering (EEE)
- Aeronautical Engineering
- Automobile Engineering
- Marine Engineering
- Artificial Intelligence and Machine Learning (AIML)
- Artificial Intelligence and Data Science (AIDS)

Undergraduate Program – Architecture
- Bachelor of Architecture (B.Arch)

Postgraduate Programs
- Master of Business Administration (MBA)
- Master of Computer Applications (MCA)
- M.Tech in Computer Science and Engineering
- M.Tech in Industrial Automation and Robotics
- M.Tech in Digital Electronics

Institutional Ethos
SIT aims to create a vibrant learning environment where innovation, research, ethics, and leadership form the core values. The institution emphasizes industry collaboration, placements, entrepreneurship, and community development — nurturing students to become globally competent professionals.

Training and Placement Officer
Dr. Dheeraj Hebri, MCA, Ph.D
Training and Placement Officer, Srinivas Institute of Technology

Department of Aeronautical Engineering
1. Dr. Praveen Shenoy — Assistant Professor — B.E., M.Tech, Ph.D
2. Dr. Gangadhara Rao — Professor — B.E., M.Tech, Ph.D
3. Mr. P. Ramesh Kumar — Professor — B.E., M.Tech
4. Dr. Lokesh K. S. — Assistant Professor — B.E., M.Tech, (Ph.D)
5. Dr. Rajesh — Assistant Professor — B.E., M.Tech, Ph.D
6. Mr. Jagadeesh B — Assistant Professor — B.E., M.Tech
7. Ms. Srinidhi Kukkila — Assistant Professor — B.E., M.Tech, MBA

Department of Artificial Intelligence and Machine Learning
1. Mrs. Daya Naik — Professor & Head (In-Charge) — B.E., M.Tech
2. Dr. Parvathraj K. M. M. — Associate Professor — B.E., M.Tech, Ph.D
3. Mr. Ganesh M. S. — Assistant Professor — B.E., M.Tech
4. Mr. Nivin — Assistant Professor — B.E., M.Tech, Diploma
5. Mrs. Nithya B. P. — Assistant Professor — B.E., M.Tech
6. Mr. Madhusudhan S. — Assistant Professor — B.E., M.Tech (Best Teacher Award 2022–23)"""

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

#         query = qa2.invoke({
#          "context": "",
#             "question": query
# })['text']

        # print(f"📝 Corrected Query: {query}")
        response = qa.invoke({
    "context": SIT_CONTEXT_TEXT,  # full paragraph you included
    "question": query
})
        response = response['text']
       
        print(f"🧠 Model (RAG) Response: {response}")

        # Fallback: If no relevant context found, answer generally
        if "don't know" in response.lower() or "not sure" in response.lower() or "cannot answer" in response.lower() or len(response.strip()) == 0 or "I'm not aware" in response.lower():
            response = llm.invoke(query+SIT_CONTEXT_TEXT)

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

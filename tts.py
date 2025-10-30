# Text-to-Speech
import pyttsx3

def speak_text(text):
    engine = pyttsx3.init()
    engine.say(text)
    engine.runAndWait()

speak_text("Hello World")


import sounddevice as sd
print(sd.query_devices())
print(sd.default.device)

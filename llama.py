from langchain.chains import ConversationChain
from langchain.memory import ConversationBufferMemory
from langchain_openai import OpenAI # Or another LLM of your choice

# Initialize your LLM
llm = OpenAI(temperature=0.7)

# Initialize the memory
memory = ConversationBufferMemory()

# Create the ConversationChain
conversation = ConversationChain(
    llm=llm,
    memory=memory,
    verbose=True # Set to True to see detailed prompts and interactions
)

# Start a conversation
print(conversation.predict(input="Hi there!"))
print(conversation.predict(input="My name is Alice."))
print(conversation.predict(input="What's your favorite color?"))
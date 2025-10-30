# Use a lightweight Python image
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Expose the backend port
EXPOSE 8000

# Run the backend (edit depending on your framework)
# For FastAPI:
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]



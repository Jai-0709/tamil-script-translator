# Dockerfile — Production Free Deployment for Render / Hugging Face
FROM python:3.10-slim

# Install system C libraries required by OpenCV and PyTorch
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source code and models
COPY backend/ ./backend/
COPY models/ ./models/

# Expose port
EXPOSE 7860 8000 10000

# Set Python path
ENV PYTHONPATH=/app

# Start FastAPI server using dynamic PORT assigned by Render or HuggingFace
CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-7860}

# Dockerfile — Production Free Deployment for Hugging Face Spaces / Render
FROM python:3.10-slim

# Install system C libraries required by OpenCV and PyTorch
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
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

# Expose port 7860 (Hugging Face default) / 8000
EXPOSE 7860 8000

# Set Python path
ENV PYTHONPATH=/app

# Start FastAPI server
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]

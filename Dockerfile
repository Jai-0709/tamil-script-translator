# Use official Python image
FROM python:3.10-slim

# Install system dependencies required by OpenCV
RUN apt-get update && apt-get install -y \
    libgl1 \
    libgl1-mesa-dri \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy the backend requirements first for caching
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Pre-download EfficientNet-B0 pretrained weights during build
# This caches them in the image so startup never needs internet access
RUN python -c "\
import os; \
os.makedirs('/root/.cache/torch/hub/checkpoints', exist_ok=True); \
from efficientnet_pytorch import EfficientNet; \
EfficientNet.from_pretrained('efficientnet-b0'); \
print('EfficientNet-B0 weights cached successfully.')"

# Copy the models and backend code
COPY models/ ./models/
COPY backend/ ./backend/

# Expose port 8000
EXPOSE 8000

# Start the FastAPI app from inside the backend directory
WORKDIR /app/backend
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

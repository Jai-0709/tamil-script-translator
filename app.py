# app.py — Native Python Entrypoint for Free Hosting (Render / Hugging Face / Koyeb)
import os
import uvicorn
from backend.main import app

if __name__ == "__main__":
    # Hugging Face default port is 7860, Render uses $PORT
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=False)

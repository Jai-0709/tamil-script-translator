"""
gemini_engine.py — Google Gemini 2.0 / 1.5 Flash Integration for Ancient Tamil Epigraphic Normalization.

Uses Google AI Studio Free Tier API Key (GEMINI_API_KEY).
If GEMINI_API_KEY is absent or API call fails/times out, seamlessly returns None to fallback to local NLP engine.
"""

import os
import json
import urllib.request
import urllib.error
from typing import List, Optional, Dict

# Attempt to load dotenv if available
try:
    from dotenv import load_dotenv
    # Load .env file from project root or backend folder
    env_backend = os.path.join(os.path.dirname(__file__), ".env")
    env_root = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(env_backend):
        load_dotenv(env_backend)
    elif os.path.exists(env_root):
        load_dotenv(env_root)
except ImportError:
    pass


def get_gemini_api_key() -> str:
    """Return GEMINI_API_KEY from environment or .env file."""
    return os.environ.get("GEMINI_API_KEY", "").strip()


def is_gemini_enabled() -> bool:
    """Return True if a valid GEMINI_API_KEY is configured."""
    return len(get_gemini_api_key()) > 5


def gemini_epigraphic_refine(raw_characters: List[str]) -> Optional[Dict]:
    """
    Calls Google Gemini API (Free Tier) to perform state-of-the-art word segmentation (சொற்பிரிப்பு),
    punctuation restoration, and ancient Tamil epigraphic translation.

    Returns:
        Dict with keys: full_sentence, alternative_readings, meaning
        Or None if Gemini is disabled/failed.
    """
    key = get_gemini_api_key()
    if not key:
        return None

    model_name = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash").strip()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"

    raw_text = "".join(raw_characters).strip()
    if not raw_text:
        return None

    system_prompt = (
        "You are an expert Ancient Tamil Epigraphist and Epigraphic Linguistics AI.\n"
        "Your task is to take a raw sequence of ancient Tamil characters extracted from stone inscriptions (கல்வெட்டுகள்), "
        "perform accurate word segmentation (சொற்பிரிப்பு), restore missing pulli dots and ligatures, "
        "and translate ancient orthography into clean modern Tamil text.\n\n"
        "Return output strictly as a JSON object matching this schema:\n"
        "{\n"
        '  "full_sentence": "clean, word-segmented modern Tamil text with proper spaces between words",\n'
        '  "alternative_readings": ["top 10 grammatically valid epigraphic readings"],\n'
        '  "meaning": "simple modern Tamil meaning of the inscription"\n'
        "}\n"
    )

    user_prompt = f'Raw Inscription Characters: "{raw_text}"\nProvide the word-segmented modern Tamil reading and top 10 alternative readings in strict JSON.'

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": system_prompt + "\n\n" + user_prompt}
                ]
            }
        ],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.1
        }
    }

    models_to_try = [
        os.environ.get("GEMINI_MODEL", "gemini-2.0-flash").strip(),
        "gemini-1.5-flash",
        "gemini-1.5-pro"
    ]
    models_to_try = list(dict.fromkeys(models_to_try))

    for model_name in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            print(f"[GEMINI] Sending epigraphic prompt to {model_name} (Free Tier)...")
            with urllib.request.urlopen(req, timeout=12) as response:
                res_data = json.loads(response.read().decode("utf-8"))

            candidates = res_data.get("candidates", [])
            if not candidates:
                continue

            text_content = candidates[0]["content"]["parts"][0]["text"]
            result = json.loads(text_content)
            print(f"[GEMINI] Successfully received epigraphic refinement from {model_name}: {result.get('full_sentence')}")
            return result
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f"[GEMINI WARN] Rate limit 429 on {model_name}. Retrying with fallback model...")
                continue
            else:
                print(f"[GEMINI WARN] HTTP {e.code} on {model_name}: {e.reason}")
                break
        except Exception as e:
            print(f"[GEMINI WARN] {model_name} call error: {e}")
            break

    print("[GEMINI WARN] Gemini API unavailable or rate-limited. Falling back to local NLP engine.")
    return None

"""
gemini_vision.py — Gemini Multimodal Vision API for Direct Inscription Reading.

Tourist Mode: Sends the FULL inscription photograph directly to Gemini's
multimodal vision model. Gemini reads the inscription from the raw image
pixels — no YOLO segmentation, no classifier, no NLP beam search.

Returns structured line-by-line Tamil + English translations with historical context.
"""

import os
import json
import base64
import urllib.request
import urllib.error
import re
from typing import Optional, Dict

# Attempt to load dotenv if available
try:
    from dotenv import load_dotenv
    env_backend = os.path.join(os.path.dirname(__file__), ".env")
    env_root = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(env_backend):
        load_dotenv(env_backend)
    elif os.path.exists(env_root):
        load_dotenv(env_root)
except ImportError:
    pass


def _get_api_key() -> str:
    """Return GEMINI_API_KEY from environment."""
    return os.environ.get("GEMINI_API_KEY", "").strip()


def gemini_vision_translate(image_bytes: bytes, mime_type: str = "image/jpeg") -> Optional[Dict]:
    """
    Send the full inscription image to Gemini's multimodal Vision API.
    Gemini reads the inscription directly from the image pixels.
    
    Returns a structured dict with line-by-line breakdown, or None on failure.
    """
    key = _get_api_key()
    if not key:
        print("[GEMINI-VISION] No GEMINI_API_KEY configured.")
        return None

    # Load fresh .env values if present
    env_file = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("GEMINI_API_KEY="):
                    key = line.split("=", 1)[1].strip()

    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    system_prompt = (
        "You are an Elite Epigraphist and Computational Epigraphy AI specializing in ancient Tamil stone inscriptions (கல்வெட்டுகள்) "
        "from the Chola, Pandya, Pallava, and Vijayanagara dynasties.\n\n"
        "TASK: Look at this photograph of an ancient Tamil stone inscription. Read EVERY line of text carved on the stone "
        "and provide a complete, accurate translation.\n\n"
        "CRITICAL RULES:\n"
        "1. READ DIRECTLY FROM THE IMAGE — examine the carved characters in the stone photograph carefully.\n"
        "2. Identify EVERY physical line of text on the stone (inscriptions are typically 3-15 lines).\n"
        "3. For EACH line, provide:\n"
        "   - The original ancient Tamil text (epigraphic_text) with proper word spacing\n"
        "   - Modern Tamil translation (modern_meaning)\n"
        "   - Fluent English translation (english_translation)\n"
        "   - A 1-2 sentence historical/epigraphic context note (historical_note)\n"
        "4. PRESERVE ancient gold weight metrics: கழஞ்சு (kalanju), மஞ்சாடி (manjadi), நாழி (naazhi), காசு (kasu).\n"
        "   Do NOT confuse gold weight terms with regnal year formulas.\n"
        "5. 'epigraphic_text' and 'full_sentence' MUST be 100% Tamil script only — NO Latin letters, NO emojis.\n"
        "6. Provide a brief overall summary in 'overall_context' (2-3 sentences about the inscription's historical significance).\n\n"
        "Return ONLY a valid JSON object in this exact format:\n"
        "{\n"
        '  "full_sentence": "Complete Tamil text of the entire inscription with word spaces",\n'
        '  "english_translation": "Complete English translation of the entire inscription",\n'
        '  "overall_context": "Brief historical significance of this inscription (2-3 sentences)",\n'
        '  "dynasty": "Detected dynasty (Chola/Pandya/Pallava/Vijayanagara/Unknown)",\n'
        '  "estimated_period": "Estimated century/period (e.g. 10th century CE)",\n'
        '  "line_count": 5,\n'
        '  "line_breakdown": [\n'
        '    {\n'
        '      "line_num": 1,\n'
        '      "epigraphic_text": "Ancient Tamil text of this line with word spacing",\n'
        '      "modern_meaning": "Modern Tamil translation of this line",\n'
        '      "english_translation": "English translation of this line",\n'
        '      "historical_note": "Historical context for this specific line"\n'
        '    }\n'
        '  ]\n'
        "}\n"
    )

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": system_prompt},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": image_b64
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1
        }
    }

    # Try multiple Gemini models with vision support (ordered by preference)
    models_to_try = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash",
    ]

    for model_name in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            print(f"[GEMINI-VISION] Sending inscription image to {model_name} for direct reading...")
            with urllib.request.urlopen(req, timeout=60) as response:
                res_data = json.loads(response.read().decode("utf-8"))

            candidates = res_data.get("candidates", [])
            if not candidates:
                print(f"[GEMINI-VISION] No candidates from {model_name}, trying next...")
                continue

            text_content = candidates[0]["content"]["parts"][0]["text"]

            # Extract JSON from response
            json_match = re.search(r'\{.*\}', text_content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group(0))
            else:
                result = json.loads(text_content)

            # Clean any accidental Latin characters from Tamil text fields
            if result:
                for field in ["full_sentence"]:
                    if field in result and isinstance(result[field], str):
                        clean = re.sub(r'\([^)]*\)', '', result[field])
                        clean = re.sub(r'[a-zA-Z]', '', clean)
                        result[field] = ' '.join(clean.split()).strip()

                # Validate line_breakdown exists
                if "line_breakdown" not in result:
                    result["line_breakdown"] = [{
                        "line_num": 1,
                        "epigraphic_text": result.get("full_sentence", ""),
                        "modern_meaning": result.get("full_sentence", ""),
                        "english_translation": result.get("english_translation", ""),
                        "historical_note": result.get("overall_context", "")
                    }]

                result["model_used"] = model_name

            print(f"[GEMINI-VISION] Successfully read inscription using {model_name}: {len(result.get('line_breakdown', []))} lines detected")
            return result

        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f"[GEMINI-VISION] Rate limit 429 on {model_name}, trying next model...")
                continue
            else:
                print(f"[GEMINI-VISION] HTTP {e.code} on {model_name}: {e.reason}")
                continue
        except Exception as e:
            print(f"[GEMINI-VISION] {model_name} error: {e}")
            continue

    print("[GEMINI-VISION] All Gemini vision models failed or rate-limited.")
    return None

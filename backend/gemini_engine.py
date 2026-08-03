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


def gemini_epigraphic_refine(raw_characters: List[str], top_variations: Optional[List[str]] = None) -> Optional[Dict]:
    """
    Calls Google Gemini API (Free Tier) to perform state-of-the-art word segmentation (சொற்பிரிப்பு),
    punctuation restoration, ancient Tamil epigraphic translation, and word-by-word meaning breakdown.

    Returns:
        Dict with keys: full_sentence, word_breakdown, alternative_readings, meaning
        Or None if Gemini is disabled/failed.
    """
    key = get_gemini_api_key()
    if not key:
        return None

    # Load fresh .env values
    env_file = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("GEMINI_API_KEY="):
                    key = line.split("=", 1)[1].strip()
                elif line.startswith("GEMINI_MODEL="):
                    os.environ["GEMINI_MODEL"] = line.split("=", 1)[1].strip()

    model_name = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite").strip()

    raw_text = "".join(raw_characters).strip()
    if not raw_text:
        return None

    variations_str = ""
    if top_variations and len(top_variations) > 0:
        variations_str = "\nTop NLP Beam Search Variations:\n" + "\n".join([f"- {v}" for v in top_variations[:50]])

    system_prompt = (
        "You are a precise Ancient Tamil Epigraphist and Epigraphic Computational Linguistics AI.\n"
        "Your primary task is to take a raw sequence of ancient Tamil characters extracted from stone inscriptions (கல்வெட்டுகள்), "
        "perform accurate word segmentation (சொற்பிரிப்பு), insert missing pulli (dots), and fix minor character typos or missing letters STRICTLY WITHIN THE GIVEN INPUT SEQUENCE.\n\n"
        "STRICT CHARACTER & WORD BOUNDARY RULES:\n"
        "1. DO NOT INVENT OR APPEND EXTRA UNRELATED WORDS OR FULL ROYAL TITLES. Only refine the words present in the given input characters. "
        "For example, if the input characters form a single word or short phrase (e.g. 'உடை யா'), your output MUST contain ONLY that single word (e.g. 'உடையார்'). "
        "DO NOT extrapolate or hallucinate un-cropped external words (such as 'ஸ்ரீ ராஜராஜ தேவர்') that are not present in the input sequence.\n"
        "2. IN-SEQUENCE RESTORATION ONLY: You may only restore a missing letter or word IF it is clearly missing in the middle of the provided sequence or completing a broken word within the input bounds.\n"
        "3. BILINGUAL ENGLISH & TAMIL OUTPUT: Provide clean modern Tamil AND fluent English translation for the refined sentence, the historical meaning, and every word breakdown item.\n\n"
        "Return output strictly as a JSON object matching this schema:\n"
        "{\n"
        '  "full_sentence": "clean, word-segmented modern Tamil text containing ONLY the refined input sequence words",\n'
        '  "english_translation": "Fluent English translation of the refined sentence",\n'
        '  "meaning": "Detailed Tamil explanation of historical meaning and context",\n'
        '  "english_meaning": "Detailed English explanation of historical meaning and context",\n'
        '  "word_breakdown": [\n'
        '    {\n'
        '      "word": "separated modern Tamil word",\n'
        '      "type": "grammatical classification",\n'
        '      "meaning": "Tamil meaning of this specific word",\n'
        '      "english_meaning": "English meaning of this specific word",\n'
        '      "is_restored": true or false\n'
        '    }\n'
        '  ],\n'
        '  "alternative_readings": ["top 10 grammatically valid epigraphic readings strictly for the input"]\n'
        "}\n"
    )

    user_prompt = (
        f'Raw Inscription Characters: "{raw_text}"{variations_str}\n'
        'Refine the input sequence by performing word segmentation and restoring pulli dots or missing middle characters. '
        'STRICT RULE: Do NOT add extra un-input words or un-cropped royal titles. Return strict JSON.'
    )

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": system_prompt + "\n\n" + user_prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1
        }
    }

    models_to_try = [
        os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite").strip(),
        "gemini-3.1-flash-lite",
        "gemini-3.1-flash",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
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
            import re
            json_match = re.search(r'\{.*\}', text_content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group(0))
            else:
                result = json.loads(text_content)

            # Post-processing safety guard:
            # If the raw input is short (<= 7 chars), ensure we don't return hallucinated extra words
            if result and "full_sentence" in result:
                raw_clean = raw_text.replace(" ", "")
                if len(raw_clean) <= 7 and result.get("word_breakdown"):
                    filtered_breakdown = []
                    valid_words = []
                    for item in result.get("word_breakdown", []):
                        w_str = item.get("word", "").strip()
                        # Check character overlap with raw input
                        has_overlap = any(char in raw_clean for char in w_str)
                        if has_overlap or len(filtered_breakdown) == 0:
                            filtered_breakdown.append(item)
                            valid_words.append(w_str)
                    if filtered_breakdown:
                        result["word_breakdown"] = filtered_breakdown
                        result["full_sentence"] = " ".join(valid_words)

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

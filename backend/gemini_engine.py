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


def gemini_epigraphic_refine(raw_characters: List[str], top_variations: Optional[List[str]] = None, line_groups: Optional[List[Dict]] = None) -> Optional[Dict]:
    """
    Calls Google Gemini API (Free Tier) to perform state-of-the-art word segmentation (சொற்பிரிப்பு),
    punctuation restoration, ancient Tamil epigraphic translation, and structured line-by-line breakdown.
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

    line_context_str = ""
    num_detected_lines = 1
    if line_groups and len(line_groups) > 0:
        num_detected_lines = len(line_groups)
        lines_formatted = []
        for lg in line_groups:
            l_num = lg.get("line", 1)
            l_txt = lg.get("text", "").strip()
            lines_formatted.append(f"Line {l_num}: \"{l_txt}\"")
        line_context_str = f"\nThe detected stone inscription contains EXACTLY {num_detected_lines} physical lines:\n" + "\n".join(lines_formatted) + "\n"

    variations_str = ""
    if top_variations and len(top_variations) > 0:
        variations_str = "\nCandidate Permutation & Combination Variations:\n" + "\n".join([f"- {v}" for v in top_variations[:50]])

    system_prompt = (
        "You are an Elite Epigraphist and Epigraphic Computational Linguistics AI specializing in Chola, Pandya, and Pallava stone inscriptions (கல்வெட்டுகள்).\n"
        "Your primary objective is to decode OCR visual/grammatical errors and reconstruct the single accurate ancient Tamil inscriptional reading.\n\n"
        "CRITICAL EPIGRAPHIC LINGUISTIC & MEASUREMENT CONSERVATION RULES:\n"
        "1. EPIGRAPHIC WORD SPACING (ALWAYS ADD CLEAN SPACES BETWEEN WORDS):\n"
        "   - Ancient stone inscriptions often lacked word spaces. In 'epigraphic_text', YOU MUST ALWAYS INSERT CLEAN SPACES BETWEEN INDIVIDUAL ANCIENT WORDS while preserving ancient spelling (e.g. return 'காலசோமனையும் பாண்டியாகளையும்' and 'செய்து குடுத்த திருப்பட்டம் ஒன்று பொன்', NOT concatenated strings like 'காலசோமனையும்பாண்டியாகளையும்')!\n"
        "2. EPIGRAPHIC GOLD WEIGHT & MEASUREMENT ACCURACY (NEVER ERASE OR CONVERT):\n"
        "   - Inscriptions frequently record gold weights, land sizes, and temple donations using terms like 'கழஞ்சு' (kalanju), 'கழஞ்சரை' (kalanju-half), 'மஞ்சாடி' (manjadi), 'நாழி' (naazhi), 'காசு' (kasu).\n"
        "   - E.g. 'இ ரு ப த ங் க ழ ஞ் ச ரை' MUST BE DECODED AS GOLD WEIGHT MEASURE 'இருபத்தைந்தரை கழஞ்சு' (25.5 Kalanju Gold Weight)! DO NOT mistake 'கழஞ்சரை' as 'ஆண்டு' or 'ஆட்சியான்டு'!\n"
        "   - E.g. 'யா ண் டு இ ரு ப த' = 'ஆண்டு இருபதாவது' (20th Regnal Year). Keep regnal years and gold weights distinct!\n"
        "3. EXACT LINE COUNT MATCH:\n"
        f"   - The input has EXACTLY {num_detected_lines} physical line(s). You MUST return EXACTLY {num_detected_lines} line item(s) in 'line_breakdown'. DO NOT add extra lines or merge them!\n"
        "4. CLEAN TAMIL SCRIPT ONLY (NO EMOJIS OR LATIN LETTERS):\n"
        "   - 'full_sentence' and 'epigraphic_text' MUST BE 100% PURE TAMIL SCRIPT ONLY (No Latin/English letters, no parentheses, no romanization, and ZERO emojis)!\n"
        "5. COMPREHENSIVE PER-LINE ANALYSIS SCHEMA (Return strict JSON object ONLY):\n"
        "{\n"
        '  "full_sentence": "Full reconstructed Tamil text combining all lines.",\n'
        '  "english_translation": "Full English translation of the entire inscription.",\n'
        '  "meaning": "Overall epigraphic context.",\n'
        '  "line_breakdown": [\n'
        '    {\n'
        '      "line_num": 1,\n'
        '      "epigraphic_text": "Classical Tamil text of Line 1 only",\n'
        '      "modern_meaning": "Clear modern standard Tamil translation of Line 1 only",\n'
        '      "english_translation": "Fluent English translation of Line 1 only",\n'
        '      "historical_note": "Rich 2-3 sentence historical & epigraphic explanation specifically for Line 1",\n'
        '      "word_breakdown": [\n'
        '        {\n'
        '          "word": "Word in Line 1",\n'
        '          "ancient_word": "Ancient spelling if different",\n'
        '          "meaning": "Modern Tamil meaning",\n'
        '          "english_meaning": "English meaning"\n'
        '        }\n'
        '      ]\n'
        '    }\n'
        '  ]\n'
        "}\n"
    )

    user_prompt = (
        f'{line_context_str}Raw Inscription Characters: "{raw_text}"{variations_str}\n'
        f'Reconstruct EXACTLY {num_detected_lines} line(s) in "line_breakdown". Provide pure Tamil script without Latin letters or parentheses. Return strict JSON.'
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

            # Strip any accidental parenthetical transliteration or notes from sentences
            if result:
                if "full_sentence" in result and isinstance(result["full_sentence"], str):
                    clean_full = re.sub(r'\([^\)]*\)', '', result["full_sentence"])
                    # Remove any English/Latin characters from full_sentence
                    clean_full = re.sub(r'[a-zA-Z]', '', clean_full)
                    result["full_sentence"] = ' '.join(clean_full.split()).strip()

                if "modern_tamil_sentence" in result and isinstance(result["modern_tamil_sentence"], str):
                    clean_mod = re.sub(r'\([^\)]*\)', '', result["modern_tamil_sentence"])
                    clean_mod = re.sub(r'[a-zA-Z]', '', clean_mod)
                    result["modern_tamil_sentence"] = ' '.join(clean_mod.split()).strip()
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
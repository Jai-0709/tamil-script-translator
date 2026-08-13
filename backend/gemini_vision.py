"""
gemini_vision.py — Hybrid Tourist Mode: YOLO/Classifier + Gemini Vision Cross-Verification.

Pipeline:
  1. Run trained YOLO + ViT/ResNet classifier (trained on ancient Tamil) silently
  2. Group detected characters into physical lines
  3. Send BOTH the detected OCR text AND the original stone photo to Gemini Vision
  4. Gemini cross-verifies the AI-detected text against the actual stone carving pixels
  5. Returns structured line-by-line Tamil + English translations with historical context

This hybrid approach ensures:
  - Ancient character detection uses YOUR trained models (best at ancient Tamil script)
  - Gemini Vision cross-references detected text with the actual image for correction
  - Zero manual intervention — tourist sees only upload + clean output
"""

import os
import json
import base64
import urllib.request
import urllib.error
import re
from typing import Optional, Dict, List

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
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    # Also check .env file directly
    env_file = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("GEMINI_API_KEY="):
                    key = line.split("=", 1)[1].strip()
    return key


def gemini_vision_hybrid_translate(
    image_bytes: bytes,
    line_groups: List[Dict],
    mime_type: str = "image/jpeg",
) -> Optional[Dict]:
    """
    Hybrid Tourist Mode translation.

    Args:
        image_bytes: Raw image file bytes (JPEG/PNG/WEBP)
        line_groups: Pre-detected line groups from YOLO + Classifier pipeline.
                     Each dict has: {"line": int, "text": str}
                     e.g. [{"line": 1, "text": "ஸ்ரீராஜராஜதேவர்க்கு"}, ...]
        mime_type: MIME type of the image

    Returns:
        Structured dict with line-by-line breakdown, or None on failure.
    """
    key = _get_api_key()
    if not key:
        print("[GEMINI-VISION] No GEMINI_API_KEY configured.")
        return None

    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    # Build the OCR context from the trained model's detections
    num_lines = len(line_groups)
    ocr_lines_str = ""
    if line_groups:
        formatted = []
        for lg in line_groups:
            l_num = lg.get("line", 1)
            l_txt = lg.get("text", "").strip()
            if l_txt:
                formatted.append(f"Line {l_num}: \"{l_txt}\"")
        ocr_lines_str = "\n".join(formatted)

    system_prompt = (
        "You are an Elite Epigraphist and Computational Epigraphy AI specializing in ancient Tamil stone inscriptions (கல்வெட்டுகள்) "
        "from the Chola, Pandya, Pallava, and Vijayanagara dynasties.\n\n"
        "TASK: You are given TWO inputs:\n"
        "  1. A PHOTOGRAPH of an ancient Tamil stone inscription\n"
        "  2. An AI-detected OCR reading of the physical lines (from a trained ancient Tamil classifier)\n\n"
        "YOUR JOB:\n"
        "  - LOOK at the stone photograph carefully to verify and correct the OCR reading\n"
        "  - Cross-reference each detected line against what you actually see carved in the stone\n"
        "  - Fix any OCR errors (character substitutions, missing characters, extra noise characters)\n"
        "  - INSERT CLEAN WORD SPACING (சொற்பிரிப்பு) BETWEEN ALL INDIVIDUAL TAMIL WORDS\n"
        "  - Provide accurate modern Tamil and English translations\n\n"
        "CRITICAL EPIGRAPHIC WORD SPACING RULES:\n"
        "1. EPIGRAPHIC WORD SPACING (MANDATORY SPACES BETWEEN WORDS):\n"
        "   - Ancient stone inscriptions lacked word spaces. In 'epigraphic_text', 'modern_meaning', and 'full_sentence', YOU MUST ALWAYS INSERT CLEAN SPACES BETWEEN INDIVIDUAL TAMIL WORDS!\n"
        "   - E.g. Return 'ஸ்ரீ ராஜராஜ தேவருக்கு ஆண்டு இருபதாவது', NOT concatenated strings like 'ஸ்ரீராஜராஜதேவர்க்கியாண்டிருபதாவது'!\n"
        "   - E.g. Return 'செய்து குடுத்த திருப்பட்டம் ஒன்று பொன்', NOT 'செயதுகுடுதததிருபபடடமஒனறுபொன'!\n"
        "2. GOLD WEIGHTS & MEASUREMENTS ACCURACY:\n"
        "   - Preserve ancient metrics — கழஞ்சு (kalanju), மஞ்சாடி (manjadi), நாழி (naazhi), காசு (kasu).\n"
        "   - E.g. 'இருபத்தைந்தரை கழஞ்சு பொன்' (25.5 Kalanju Gold Weight). Do NOT confuse gold weights with regnal year formulas.\n"
        "3. PURE TAMIL SCRIPT ONLY:\n"
        "   - 'epigraphic_text', 'modern_meaning', and 'full_sentence' MUST be 100% pure Tamil script — NO Latin/English letters, NO parentheses, NO emojis.\n"
        f"4. PHYSICAL LINE COUNT: The OCR detected {num_lines} physical line(s). Verify against the image — adjust line breakdown if needed.\n"
        "5. OVERALL CONTEXT: Provide a brief historical summary (dynasty, period, temple, purpose).\n\n"
        "Return ONLY a valid JSON object in this exact format:\n"
        "{\n"
        '  "full_sentence": "Complete corrected Tamil text of the entire inscription with clean word spaces",\n'
        '  "english_translation": "Complete English translation",\n'
        '  "overall_context": "Brief historical significance (2-3 sentences)",\n'
        '  "dynasty": "Chola/Pandya/Pallava/Vijayanagara/Unknown",\n'
        '  "estimated_period": "e.g. 10th century CE",\n'
        '  "line_count": N,\n'
        '  "line_breakdown": [\n'
        '    {\n'
        '      "line_num": 1,\n'
        '      "epigraphic_text": "Ancient Tamil text of this line with clean word spaces",\n'
        '      "modern_meaning": "Modern Tamil translation of this line with clean word spaces",\n'
        '      "english_translation": "English translation of this line",\n'
        '      "historical_note": "Historical context for this specific line"\n'
        '    }\n'
        '  ]\n'
        "}\n"
    )

    user_prompt = (
        f"AI-Detected OCR Reading ({num_lines} lines):\n"
        f"{ocr_lines_str}\n\n"
        "Now look at the actual stone inscription photograph below. "
        "Cross-verify the OCR reading against the image, fix any errors, "
        "and provide the complete structured translation."
    )

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": system_prompt + "\n\n" + user_prompt},
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

    # Try multiple Gemini models with vision support
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
            print(f"[GEMINI-VISION] Sending OCR + image to {model_name} for hybrid cross-verification...")
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

                # Ensure line_breakdown exists
                if "line_breakdown" not in result:
                    result["line_breakdown"] = [{
                        "line_num": 1,
                        "epigraphic_text": result.get("full_sentence", ""),
                        "modern_meaning": result.get("full_sentence", ""),
                        "english_translation": result.get("english_translation", ""),
                        "historical_note": result.get("overall_context", "")
                    }]

                result["model_used"] = model_name

            print(f"[GEMINI-VISION] Hybrid translation successful via {model_name}: "
                  f"{len(result.get('line_breakdown', []))} lines")
            return result

        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f"[GEMINI-VISION] Rate limit 429 on {model_name}, trying next...")
                continue
            else:
                print(f"[GEMINI-VISION] HTTP {e.code} on {model_name}: {e.reason}")
                continue
        except Exception as e:
            print(f"[GEMINI-VISION] {model_name} error: {e}")
            continue

    print("[GEMINI-VISION] All Gemini vision models failed or rate-limited.")
    return None

import os
import json
import re
import urllib.request
import time
from collections import defaultdict
from pathlib import Path

# ─────────────────────────────────────────────
#  PATHS
# ─────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODELS_DIR = BASE_DIR / "models"
NGRAM_PATH = MODELS_DIR / "tamil_bigrams.json"

# Tamil Unicode Block: U+0B80 to U+0BFF
TAMIL_REGEX = re.compile(r'[\u0b80-\u0bff]+')

def fetch_wikipedia_articles(num_batches=50, limit_per_batch=50):
    """
    Fetches random Tamil Wikipedia articles using the MediaWiki API.
    Returns a single massive string of Tamil text.
    """
    print(f"[INFO] Fetching ~{num_batches * limit_per_batch} random Tamil Wikipedia articles...")
    full_text = ""
    
    url = f"https://ta.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&explaintext&generator=random&grnnamespace=0&grnlimit={limit_per_batch}"
    
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    
    for i in range(num_batches):
        print(f"  Fetching batch {i+1}/{num_batches}...", end="\r")
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))
                pages = data.get("query", {}).get("pages", {})
                
                for page_id, page_info in pages.items():
                    extract = page_info.get("extract", "")
                    if extract:
                        full_text += extract + " "
                        
            time.sleep(1.5) # Be very polite to avoid HTTP 429
        except Exception as e:
            print(f"\n  [ERROR] Batch {i+1} failed: {e}")
            
    print(f"\n[INFO] Fetched {len(full_text)} characters of text.")
    return full_text

def build_bigram_model(text: str):
    print("[INFO] Building character Bigram model...")
    
    # Inject common ancient Tamil inscription words to guarantee correct bigram transitions
    # even if Wikipedia doesn't have them in the random sample.
    common_words = " ஶ்ரீராஜராஜ உடையார் பாண்டிய சோழ பல்லவ " * 100
    text += common_words
    
    # Find all Tamil words in the text
    words = TAMIL_REGEX.findall(text)
    print(f"[INFO] Found {len(words)} Tamil words.")
    
    # We will count how many times char_B follows char_A
    # bigram_counts[char_A][char_B] = count
    bigram_counts = defaultdict(lambda: defaultdict(int))
    char_counts = defaultdict(int)
    
    for word in words:
        # We process the word character by character. 
        # Use a regex to split a Tamil word into its logical graphemes (Uyirmei letters).
        # A grapheme is a base consonant/vowel (\u0B83-\u0BB9) optionally followed by combining marks (\u0BBE-\u0BCD\u0BD7).
        chars = re.findall(r'[\u0B83-\u0BB9][\u0BBE-\u0BCD\u0BD7]*', word)
        for i in range(len(chars) - 1):
            c1 = chars[i]
            c2 = chars[i+1]
            bigram_counts[c1][c2] += 1
            char_counts[c1] += 1
            
        if len(chars) > 0:
            char_counts[chars[-1]] += 1
            
    # Convert counts to probabilities (log probabilities to prevent underflow)
    # P(c2 | c1) = Count(c1, c2) / Count(c1)
    import math
    bigram_probs = defaultdict(dict)
    
    # We use Laplace smoothing (add 1) so unseen pairs don't have probability 0 (-infinity)
    vocab_size = len(char_counts)
    
    for c1, total_c1 in char_counts.items():
        for c2 in char_counts.keys():
            count_c1_c2 = bigram_counts[c1].get(c2, 0)
            # Add-1 Smoothing
            prob = (count_c1_c2 + 1) / (total_c1 + vocab_size)
            # Store as Log Probability
            bigram_probs[c1][c2] = math.log(prob)
            
    return dict(bigram_probs)

def main():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    
    # 1. Scrape Tamil text
    text = fetch_wikipedia_articles(num_batches=20) # ~1000 articles
    
    if len(text) < 1000:
        print("[ERROR] Failed to fetch enough text. Please check your internet connection.")
        return
        
    # 2. Build model
    bigram_probs = build_bigram_model(text)
    
    # 3. Save to JSON
    print(f"[INFO] Saving Bigram model to {NGRAM_PATH}")
    with open(NGRAM_PATH, "w", encoding="utf-8") as f:
        json.dump(bigram_probs, f, ensure_ascii=False, indent=2)
        
    print("[INFO] Done! The mathematical Tamil Language Model is ready.")

if __name__ == "__main__":
    main()

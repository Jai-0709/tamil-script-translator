import json
import re
from pathlib import Path
from typing import List

# ─────────────────────────────────────────────
#  PATHS
# ─────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
NGRAM_PATH = BASE_DIR / "models" / "tamil_bigrams.json"

class NLPEngine:
    def __init__(self):
        self.bigram_probs = {}
        self.is_loaded = False
        
        self.load_model()
        
    def load_model(self):
        if not NGRAM_PATH.exists():
            print(f"[NLP] Warning: Bigram model not found at {NGRAM_PATH}. NLP Engine will fall back to naive selection.")
            return
            
        try:
            with open(NGRAM_PATH, "r", encoding="utf-8") as f:
                self.bigram_probs = json.load(f)
            self.is_loaded = True
            print("[NLP] Successfully loaded Tamil Mathematical Bigram Model.")
        except Exception as e:
            print(f"[NLP] Error loading bigram model: {e}")

    def get_log_prob(self, char1: str, char2: str) -> float:
        """
        Returns the log probability of char2 following char1 with Ancient Tamil Epigraphic Phrase Boosting.
        """
        DEFAULT_PENALTY = -20.0
        
        # High-frequency Ancient Tamil Epigraphic Transitions (Chola/Pandya Inscription Lexicon)
        EPIGRAPHIC_BOOST = {
            ('உ', 'டை'): 5.0, ('டை', 'யா'): 5.0, ('யா', 'ர்'): 5.0, ('ர்', 'ஸ்ரீ'): 5.0,
            ('ஸ்ரீ', 'ரா'): 6.0, ('ரா', 'ஜ'): 6.0, ('ஜ', 'ரா'): 6.0, ('ஜ', 'தே'): 6.0,
            ('தே', 'வ'): 6.0, ('வ', 'ர்'): 6.0, ('தே', 'வர்'): 6.0, ('வர்', 'க்'): 5.0,
            ('இ', 'ரு'): 5.0, ('ரு', 'ப'): 5.0, ('ப', 'த்'): 5.0, ('த்', 'து'): 6.0,
            ('து', 'ங்'): 5.0, ('ங்', 'க'): 5.0, ('க', 'ழ்'): 5.0, ('ழ்', 'ஞ்'): 5.0,
            ('ஞ்', 'ச'): 5.0, ('ச', 'ரை'): 5.0,
            ('நா', 'ற்'): 5.0, ('ற்', 'ப'): 5.0, ('ப', 'தி'): 5.0, ('தி', 'ன்'): 5.0,
            ('ன்', 'க'): 5.0, ('ஞ்', 'செ'): 5.0, ('செ', 'ய்'): 5.0, ('ய்', 'கா'): 5.0,
            ('கா', 'ல'): 5.0,
            ('கு', 'டு'): 5.0, ('டு', 'த்'): 5.0, ('த்', 'த'): 5.0, ('த', 'பொ'): 5.0,
            ('பொ', 'ன்'): 5.0, ('ன்', 'னி'): 5.0, ('னி', 'ன்'): 5.0,
            ('ம', 'லை'): 5.0, ('லை', 'நா'): 5.0, ('நா', 'டு'): 5.0, ('யார', 'ஸ்ரீ'): 5.0
        }
        
        # 1. Split into logical Tamil graphemes using standard regex
        graphemes_1 = re.findall(r'[\u0B83-\u0BB9][\u0BBE-\u0BCD\u0BD7]*', char1)
        graphemes_2 = re.findall(r'[\u0B83-\u0BB9][\u0BBE-\u0BCD\u0BD7]*', char2)
        
        if not graphemes_1: graphemes_1 = [char1]
        if not graphemes_2: graphemes_2 = [char2]
            
        sequence = graphemes_1 + graphemes_2
        
        total_log_prob = 0.0
        for i in range(len(sequence) - 1):
            c1 = sequence[i]
            c2 = sequence[i+1]
            
            boost = EPIGRAPHIC_BOOST.get((c1, c2), 0.0)
            if c1 in self.bigram_probs and c2 in self.bigram_probs[c1]:
                total_log_prob += self.bigram_probs[c1][c2] + boost
            else:
                total_log_prob += (DEFAULT_PENALTY + boost)
                
        num_transitions = max(1, len(sequence) - 1)
        return total_log_prob / num_transitions

    def beam_search_decode(self, sequence_options: List[List], top_k: int = 3) -> List[List[str]]:
        """
        Solves the ambiguous character puzzle using Beam Search.
        Finds the top_k most mathematically probable full sequence paths by combining
        Vision Classifier scores + Tamil Language Model N-gram transition probabilities.
        
        Args:
            sequence_options: List of possible characters (or tuples of (char, score)) for each position.
            top_k: Number of alternative paths to return.
            
        Returns:
            A list of the top_k best paths (each path is a List[str]), ordered by probability descending.
        """
        if not sequence_options:
            return []
            
        # Standardize options to (char_str, vision_log_prob)
        parsed_sequence = []
        for opts in sequence_options:
            parsed_opts = []
            for item in opts:
                if isinstance(item, tuple):
                    c_str, score = item
                    import math
                    v_prob = math.log(max(0.01, float(score)))
                else:
                    c_str = str(item)
                    v_prob = 0.0
                if c_str and c_str not in [p[0] for p in parsed_opts]:
                    parsed_opts.append((c_str, v_prob))
            if parsed_opts:
                parsed_sequence.append(parsed_opts)

        if not parsed_sequence:
            return []

        if not self.is_loaded:
            fallback = [opts[0][0] for opts in parsed_sequence]
            return [fallback]

        # Beam states: List of tuples (total_log_prob, path_list)
        beam = []
        for char, v_prob in parsed_sequence[0]:
            beam.append((v_prob, [char]))

        # Run Beam Search across positions
        for t in range(1, len(parsed_sequence)):
            current_options = parsed_sequence[t]
            new_beam = []
            
            for prev_prob, prev_path in beam:
                prev_char = prev_path[-1]
                
                for current_char, v_prob in current_options:
                    transition_prob = self.get_log_prob(prev_char, current_char)
                    total_prob = prev_prob + transition_prob + (v_prob * 1.5)
                    
                    new_path = prev_path + [current_char]
                    new_beam.append((total_prob, new_path))
                    
            new_beam.sort(key=lambda x: x[0], reverse=True)
            beam = new_beam[:max(16, top_k * 2)]
            
        # Deduplicate and return top_k paths
        result_paths = []
        seen = set()
        for _, path in beam:
            path_key = tuple(path)
            if path_key not in seen:
                seen.add(path_key)
                result_paths.append(path)
                if len(result_paths) >= top_k:
                    break

        return result_paths

    def viterbi_decode(self, sequence_options: List[List[str]]) -> List[str]:
        """
        Legacy single-path decoder. Wraps beam_search_decode with top_k=1.
        """
        paths = self.beam_search_decode(sequence_options, top_k=1)
        return paths[0] if paths else []

# Global Singleton
nlp_engine = NLPEngine()

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
        Returns the log probability of char2 following char1.
        If the characters are multi-grapheme ligatures (e.g., 'வர்'), they are automatically
        split into their base graphemes ('வ', 'ர்') and the total transition probability is summed.
        """
        DEFAULT_PENALTY = -20.0
        
        # 1. Split into logical Tamil graphemes using the standard regex
        graphemes_1 = re.findall(r'[\u0B83-\u0BB9][\u0BBE-\u0BCD\u0BD7]*', char1)
        graphemes_2 = re.findall(r'[\u0B83-\u0BB9][\u0BBE-\u0BCD\u0BD7]*', char2)
        
        # Fallback if regex fails (e.g., english letters or numbers)
        if not graphemes_1: graphemes_1 = [char1]
        if not graphemes_2: graphemes_2 = [char2]
            
        sequence = graphemes_1 + graphemes_2
        
        total_log_prob = 0.0
        for i in range(len(sequence) - 1):
            c1 = sequence[i]
            c2 = sequence[i+1]
            
            if c1 in self.bigram_probs and c2 in self.bigram_probs[c1]:
                total_log_prob += self.bigram_probs[c1][c2]
            else:
                total_log_prob += DEFAULT_PENALTY
                
        num_transitions = max(1, len(sequence) - 1)
        return total_log_prob / num_transitions

    def beam_search_decode(self, sequence_options: List[List[str]], top_k: int = 3) -> List[List[str]]:
        """
        Solves the ambiguous character puzzle using Beam Search.
        Finds the top_k most mathematically probable full sequence paths.
        
        Args:
            sequence_options: List of possible characters for each position.
            top_k: Number of alternative paths to return.
            
        Returns:
            A list of the top_k best paths (each path is a List[str]), ordered by probability descending.
        """
        if not sequence_options:
            return []
            
        if not self.is_loaded:
            # Fallback: Just return the first option for all characters
            fallback = [opts[0] for opts in sequence_options if opts]
            return [fallback]
            
        # Beam states: List of tuples (log_prob, path)
        # Initialize with first character options
        beam = []
        for char in sequence_options[0]:
            beam.append((0.0, [char]))
            
        # Run Beam Search for t > 0
        for t in range(1, len(sequence_options)):
            current_options = sequence_options[t]
            new_beam = []
            
            # For every path currently in the beam...
            for prev_prob, prev_path in beam:
                prev_char = prev_path[-1]
                
                # ...explore all possible next characters
                for current_char in current_options:
                    transition_prob = self.get_log_prob(prev_char, current_char)
                    total_prob = prev_prob + transition_prob
                    
                    new_path = prev_path + [current_char]
                    new_beam.append((total_prob, new_path))
                    
            # Sort all new paths by probability (descending) and keep the top_k
            new_beam.sort(key=lambda x: x[0], reverse=True)
            beam = new_beam[:top_k]
            
        # Return just the paths (strip the probabilities)
        return [path for prob, path in beam]

    def viterbi_decode(self, sequence_options: List[List[str]]) -> List[str]:
        """
        Legacy single-path decoder. Wraps beam_search_decode with top_k=1.
        """
        paths = self.beam_search_decode(sequence_options, top_k=1)
        return paths[0] if paths else []

# Global Singleton
nlp_engine = NLPEngine()

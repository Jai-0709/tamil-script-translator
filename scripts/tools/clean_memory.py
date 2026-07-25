import json
import numpy as np
import os

MEMORY_FILE = "backend/corrections_memory.json"

def cosine_similarity(v1, v2):
    v1 = np.array(v1)
    v2 = np.array(v2)
    return float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9))

if os.path.exists(MEMORY_FILE):
    with open(MEMORY_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"Total raw memory entries: {len(data)}")
    
    clean_memory = []
    # Process from newest to oldest
    for item in reversed(data):
        vec = item["vector"]
        char = item["modern_tamil"]
        
        # Check if already present in clean_memory with high similarity (>0.88)
        duplicate = False
        for clean_item in clean_memory:
            if cosine_similarity(vec, clean_item["vector"]) > 0.88:
                duplicate = True
                break
        
        if not duplicate:
            clean_memory.append(item)
            
    clean_memory.reverse()
    print(f"Deduplicated memory entries: {len(clean_memory)}")
    
    with open(MEMORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(clean_memory, f, ensure_ascii=False)
    print("Memory database successfully cleaned!")

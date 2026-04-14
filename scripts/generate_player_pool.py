import json
import os
from glob import glob

BASE_DIR = os.getcwd()
ROSTERS_DIR = os.path.join(BASE_DIR, 'src', 'data', 'rosters')
SCRAPED_PLAYERS_PATH = os.path.join(BASE_DIR, 'src', 'data', 'scraped_players.json')
OUTPUT_PATH = os.path.join(BASE_DIR, 'src', 'data', 'all_players_pool.json')

def generate_pool():
    print("Generating global player pool with ID sync...")
    
    # 1. Load all rosters
    roster_files = glob(os.path.join(ROSTERS_DIR, "*.json"))
    roster_files = [f for f in roster_files if "career_stats" not in f]
    
    all_roster_players = []
    for rf in roster_files:
        with open(rf, 'r') as f:
            all_roster_players.extend(json.load(f))
    
    print(f"  Loaded {len(all_roster_players)} players from rosters.")

    # 2. Load scraped fantasy data (stars/ADP)
    with open(SCRAPED_PLAYERS_PATH, 'r') as f:
        scraped_players = json.load(f)
    print(f"  Loaded {len(scraped_players)} players from scraped_players.json.")

    # Index rosters for enrichment
    roster_lookup = {}
    for p in all_roster_players:
        k = (f"{p['firstName']} {p['lastName']}".lower(), p['position'])
        roster_lookup[k] = p

    # 3. Deduplicate and Sync
    seen_keys = {}
    final_pool = []
    
    # Priority A: Scraped Players (They have ADP/Projections)
    for p in scraped_players:
        key = (f"{p['firstName']} {p['lastName']}".lower(), p['position'])
        
        # Enrich with ESPN ID from roster if missing
        if key in roster_lookup:
            rp = roster_lookup[key]
            if not p.get('espnId'):
                p['espnId'] = rp.get('espnId') or rp.get('sourceId')
        
        if key not in seen_keys:
            final_pool.append(p)
            seen_keys[key] = True
            
    # Priority B: Roster Players (Depth players not in scraped list)
    added_depth = 0
    for p in all_roster_players:
        key = (f"{p['firstName']} {p['lastName']}".lower(), p['position'])
        if key not in seen_keys:
            final_pool.append({
                "id": p.get('id') or p.get('sourceId'),
                "firstName": p['firstName'],
                "lastName": p['lastName'],
                "position": p['position'],
                "team": p['team'],
                "photoUrl": p.get('headshotUrl'),
                "height": p.get('height'),
                "weight": p.get('weight'),
                "college": p.get('college'),
                "age": p.get('age'),
                "espnId": p.get('espnId') or p.get('sourceId'),
                "adp": 300,
                "projectedPoints": 0,
                "ownership": "0%",
                "source": "roster"
            })
            seen_keys[key] = True
            added_depth += 1
            
    print(f"  Added {added_depth} depth players from rosters.")
    print(f"  Total unique players in pool: {len(final_pool)}")

    with open(OUTPUT_PATH, 'w') as f:
        json.dump(final_pool, f, indent=2)
    print(f"Saved pool to {OUTPUT_PATH}")

if __name__ == "__main__":
    generate_pool()

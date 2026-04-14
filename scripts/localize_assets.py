import json
import os
import requests
import re
from glob import glob

# Paths
BASE_DIR = os.getcwd()
DATA_DIR = os.path.join(BASE_DIR, 'src', 'data')
ROSTERS_DIR = os.path.join(DATA_DIR, 'rosters')
PUBLIC_DIR = os.path.join(BASE_DIR, 'public', 'images')
PLAYERS_DIR = os.path.join(PUBLIC_DIR, 'players')
TEAMS_DIR = os.path.join(PUBLIC_DIR, 'teams')

# Central Data
MOCK_DB_PATH = os.path.join(DATA_DIR, 'mockDB.ts')
SCRAPED_PLAYERS_PATH = os.path.join(DATA_DIR, 'scraped_players.json')

# Global Mapping to avoid redundant downloads
# url -> local_filename
url_to_local = {}

def sanitize_filename(name):
    return re.sub(r'[\\/*?:"<>|~]', '_', name)

def download_image(url, folder, filename):
    if not url or 'placeholder' in url:
        return None
    
    if url in url_to_local:
        return url_to_local[url]
    
    filename = sanitize_filename(filename)
    path = os.path.join(folder, filename)
    
    # Check if already exists on disk
    if os.path.exists(path):
        url_to_local[url] = filename
        return filename
    
    try:
        response = requests.get(url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
        if response.status_code == 200:
            with open(path, 'wb') as f:
                f.write(response.content)
            print(f"Downloaded: {filename}")
            url_to_local[url] = filename
            return filename
        else:
            print(f"Failed {url}: Code {response.status_code}")
    except Exception as e:
        print(f"Error downloading {url}: {e}")
    return None

def process_rosters():
    print("Processing all league rosters...")
    roster_files = glob(os.path.join(ROSTERS_DIR, "*.json"))
    # Skip career_stats.json
    roster_files = [f for f in roster_files if "career_stats" not in f]
    
    # Mapping for sync with scraped_players
    # (fullName, team) -> localUrl
    player_to_local = {}

    for rf in roster_files:
        print(f"Localizing: {os.path.basename(rf)}")
        with open(rf, 'r') as f:
            data = json.load(f)
        
        changed = False
        for p in data:
            url = p.get('headshotUrl')
            # Only download if it's an external URL
            if url and url.startswith('http'):
                pid = p.get('sourceId') or p.get('id') or str(abs(hash(url)))
                filename = f"{pid}.png"
                local_name = download_image(url, PLAYERS_DIR, filename)
                if local_name:
                    p['headshotUrl'] = f"/images/players/{local_name}"
                    changed = True
                    player_to_local[(p['fullName'].lower(), p['team'].upper())] = p['headshotUrl']
            elif url and url.startswith('/images'):
                player_to_local[(p['fullName'].lower(), p['team'].upper())] = url

        if changed:
            with open(rf, 'w') as f:
                json.dump(data, f, indent=2)
    
    return player_to_local

def sync_scraped_players(player_to_local):
    print("Synchronizing localized photos with scraped_players.json...")
    if not os.path.exists(SCRAPED_PLAYERS_PATH):
        return
        
    with open(SCRAPED_PLAYERS_PATH, 'r') as f:
        data = json.load(f)
    
    changed = False
    for p in data:
        key = (f"{p['firstName']} {p['lastName']}".lower(), p['team'].upper())
        if key in player_to_local:
            if p.get('photoUrl') != player_to_local[key]:
                p['photoUrl'] = player_to_local[key]
                changed = True
        elif p.get('espnId') and not p.get('photoUrl'):
            # Fallback construct
            url = f"https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/{p['espnId']}.png&w=1000&h=1000&scale=crop"
            local_name = download_image(url, PLAYERS_DIR, f"{p['espnId']}.png")
            if local_name:
                p['photoUrl'] = f"/images/players/{local_name}"
                changed = True

    if changed:
        with open(SCRAPED_PLAYERS_PATH, 'w') as f:
            json.dump(data, f, indent=2)

def localize_mock_db():
    print("Localizing mockDB.ts images...")
    if not os.path.exists(MOCK_DB_PATH):
        return

    with open(MOCK_DB_PATH, 'r') as f:
        content = f.read()
    
    legacy_pattern = r"photoUrl:\s*'([^']+)'"
    matches = list(re.finditer(legacy_pattern, content))
    
    for match in matches:
        url = match.group(1)
        if url.startswith('http'):
            if 'headshots' in url:
                player_id_match = re.search(r'full/(\d+)\.png', url)
                player_id = player_id_match.group(1) if player_id_match else "legacy_" + str(abs(hash(url)))
                filename = f"{player_id}.png"
                local_name = download_image(url, PLAYERS_DIR, filename)
                if local_name:
                    content = content.replace(url, f"/images/players/{local_name}")
            elif 'teamlogos' in url or 'league' in url:
                team_match = re.search(r'nfl/500/(\w+)\.png', url)
                team_code = team_match.group(1) if team_match else "generic_" + str(abs(hash(url)))
                filename = f"{team_code}.png"
                local_name = download_image(url, TEAMS_DIR, filename)
                if local_name:
                    content = content.replace(url, f"/images/teams/{local_name}")
                
    with open(MOCK_DB_PATH, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    if not os.path.exists(PLAYERS_DIR): os.makedirs(PLAYERS_DIR)
    if not os.path.exists(TEAMS_DIR): os.makedirs(TEAMS_DIR)
    
    player_to_local_map = process_rosters()
    sync_scraped_players(player_to_local_map)
    localize_mock_db()
    print("Localization complete.")

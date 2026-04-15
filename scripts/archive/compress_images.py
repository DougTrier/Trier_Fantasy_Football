import os
import json
import re
from PIL import Image
from glob import glob

# Paths
BASE_DIR = os.getcwd()
PUBLIC_DIR = os.path.join(BASE_DIR, 'public', 'images')
PLAYERS_DIR = os.path.join(PUBLIC_DIR, 'players')
TEAMS_DIR = os.path.join(PUBLIC_DIR, 'teams')
DATA_DIR = os.path.join(BASE_DIR, 'src', 'data')
ROSTERS_DIR = os.path.join(DATA_DIR, 'rosters')
MOCK_DB_PATH = os.path.join(DATA_DIR, 'mockDB.ts')
SCRAPED_PLAYERS_PATH = os.path.join(DATA_DIR, 'scraped_players.json')

def compress_folder(folder):
    print(f"Compressing images in {os.path.basename(folder)}...")
    files = glob(os.path.join(folder, "*.png"))
    count = 0
    for f in files:
        try:
            with Image.open(f) as img:
                target = f.replace(".png", ".webp")
                # Convert RGBA to RGB if needed, but WebP handles alpha fine
                img.save(target, "WEBP", quality=85)
            os.remove(f) # Remove original
            count += 1
            if count % 100 == 0:
                print(f"  Processed {count} images...")
        except Exception as e:
            print(f"  Failed to compress {f}: {e}")
    print(f"Done. Processed {count} images.")

def update_json_files():
    print("Updating .json data references...")
    # Process Roster JSONs
    json_files = glob(os.path.join(ROSTERS_DIR, "*.json"))
    json_files.append(SCRAPED_PLAYERS_PATH)
    
    for jf in json_files:
        if not os.path.exists(jf): continue
        with open(jf, 'r') as f:
            content = f.read()
        
        # Replace .png pointers with .webp in paths starting with /images/
        new_content = content.replace(".png", ".webp")
        
        if new_content != content:
            with open(jf, 'w') as f:
                f.write(new_content)
            print(f"  Updated: {os.path.basename(jf)}")

def update_mock_db():
    print("Updating mockDB.ts references...")
    if not os.path.exists(MOCK_DB_PATH): return
    
    with open(MOCK_DB_PATH, 'r') as f:
        content = f.read()
    
    # Replace .png with .webp in photoUrl strings
    new_content = content.replace(".png", ".webp")
    
    if new_content != content:
        with open(MOCK_DB_PATH, 'w') as f:
            f.write(new_content)
        print("  Updated mockDB.ts")

if __name__ == "__main__":
    initial_size = sum(os.path.getsize(os.path.join(root, f)) for root, dirs, files in os.walk(PUBLIC_DIR) for f in files)
    
    compress_folder(PLAYERS_DIR)
    compress_folder(TEAMS_DIR)
    update_json_files()
    update_mock_db()
    
    final_size = sum(os.path.getsize(os.path.join(root, f)) for root, dirs, files in os.walk(PUBLIC_DIR) for f in files)
    print("\nCompression Summary:")
    print(f"  Original Size: {initial_size / (1024*1024):.2f} MB")
    print(f"  Compressed Size: {final_size / (1024*1024):.2f} MB")
    print(f"  Savings: {(initial_size - final_size) / (1024*1024):.2f} MB")

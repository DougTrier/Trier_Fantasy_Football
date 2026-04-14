import fs from 'fs';
import pngToIco from 'png-to-ico';

const srcPath = 'C:/Users/Doug/.gemini/antigravity/brain/30c1fbf2-f997-4a1b-bb40-08a1d5e7f9ff/uploaded_media_1770014977238.png';
const destPath = 'g:/Vibe Coding/TrierFantasy/src-tauri/icons/icon.ico';

pngToIco(srcPath)
    .then(buf => {
        fs.writeFileSync(destPath, buf);
        console.log(`Successfully converted ${srcPath} to ${destPath}`);
    })
    .catch(err => {
        console.error('Error converting PNG to ICO:', err);
        process.exit(1);
    });

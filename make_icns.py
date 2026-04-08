from PIL import Image
import subprocess, os, shutil

src = "/home/ubuntu/goal-icon.png"
iconset = "/home/ubuntu/AppIcon.iconset"
os.makedirs(iconset, exist_ok=True)

img = Image.open(src)

sizes = [16, 32, 64, 128, 256, 512, 1024]
for s in sizes:
    resized = img.resize((s, s), Image.LANCZOS)
    resized.save(os.path.join(iconset, f"icon_{s}x{s}.png"))
    # Also save @2x versions
    if s <= 512:
        resized2x = img.resize((s*2, s*2), Image.LANCZOS)
        resized2x.save(os.path.join(iconset, f"icon_{s}x{s}@2x.png"))

print("Iconset created at", iconset)
print("Files:", os.listdir(iconset))

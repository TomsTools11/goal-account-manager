#!/usr/bin/env python3
from PIL import Image
import struct, io, os

src = "goal-icon.png"
out_path = os.path.join("GOAL Account Manager.app", "Contents", "Resources", "AppIcon.icns")

img = Image.open(src).convert("RGBA")

def png_data(image, size):
    resized = image.resize((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    resized.save(buf, "PNG")
    return buf.getvalue()

# macOS ICNS type codes for PNG-based entries
type_map = {
    16: b"icp4",
    32: b"icp5",
    64: b"icp6",
    128: b"ic07",
    256: b"ic08",
    512: b"ic09",
    1024: b"ic10",
}

entries = []
for size, icon_type in sorted(type_map.items()):
    data = png_data(img, size)
    entry_size = 8 + len(data)
    entries.append(icon_type + struct.pack(">I", entry_size) + data)
    print(f"  {icon_type.decode()} -> {size}x{size} ({len(data)} bytes)")

body = b"".join(entries)
total = 8 + len(body)
icns = b"icns" + struct.pack(">I", total) + body

with open(out_path, "wb") as f:
    f.write(icns)

print(f"\nCreated {out_path} ({total:,} bytes)")

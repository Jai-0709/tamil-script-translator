"""
Render Tamil characters as images so we can visually match them to dataset images.
Tamil vowels (uyir): அ ஆ இ ஈ உ ஊ எ ஏ ஐ ஒ ஓ ஔ
Tamil consonants (mei): க ங ச ஞ ட ண த ந ப ம ய ர ல வ ழ ள ற ன
"""

from PIL import Image, ImageDraw, ImageFont
import os

CHARS = [
    # vowels
    ("அ","a"),("ஆ","aa"),("இ","i"),("ஈ","ii"),("உ","u"),("ஊ","uu"),
    ("எ","e"),("ஏ","ee"),("ஐ","ai"),("ஒ","o"),("ஓ","oo"),("ஔ","au"),
    # consonants
    ("க","ka"),("ங","nga"),("ச","cha"),("ஞ","nya"),("ட","ta1"),("ண","na1"),
    ("த","tha"),("ந","na2"),("ப","pa"),("ம","ma"),("ய","ya"),("ர","ra"),
    ("ல","la"),("வ","va"),("ழ","zha"),("ள","lla"),("ற","rra"),("ன","nna"),
    # common compound / other
    ("நி","ni"),("நீ","nii"),("தி","ti"),("து","tu"),
]

out_dir = r"E:\TAMIL SCRIPT VERSION 2\debug\tamil_ref"
os.makedirs(out_dir, exist_ok=True)

# Try to find a Tamil-supporting font
font_paths = [
    r"C:\Windows\Fonts\Latha.ttf",
    r"C:\Windows\Fonts\ebrima.ttf",
    r"C:\Windows\Fonts\Aparajita.ttf",
    r"C:\Windows\Fonts\Nirmala.ttf",
    r"C:\Windows\Fonts\NirmalaUI.ttf",
]
font = None
for fp in font_paths:
    if os.path.exists(fp):
        try:
            font = ImageFont.truetype(fp, 120)
            print(f"Using font: {fp}")
            break
        except:
            pass

if font is None:
    print("No Tamil font found! Install Latha or Nirmala.")
else:
    for ch, name in CHARS:
        img = Image.new("RGB", (200, 200), "white")
        d = ImageDraw.Draw(img)
        d.text((50, 40), ch, font=font, fill="black")
        img.save(os.path.join(out_dir, f"{name}_{ord(ch[0]):04X}.png"))
    print(f"Saved {len(CHARS)} reference images to {out_dir}")
    
    # Also print Unicode points for each
    print("\nTamil character Unicode reference:")
    for ch, name in CHARS:
        print(f"  {name:8s} U+{ord(ch[0]):04X}  {ch}")

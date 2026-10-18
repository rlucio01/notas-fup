import os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SRC_IMAGE = r"C:\Users\rafae\.gemini\antigravity-ide\brain\956d6936-7cd6-488f-ab88-7acc897e7d3b\.user_uploaded\media_1792296365238.jpg"

def main():
    if not os.path.exists(SRC_IMAGE):
        print(f"Erro: arquivo não encontrado em {SRC_IMAGE}")
        return

    # 1. Load image and create clean transparent alpha mask
    img = Image.open(SRC_IMAGE).convert("RGBA")
    gray = img.convert("L")

    # Threshold outer black pixels
    mask_bg = gray.point(lambda p: 255 if p <= 8 else 0)

    # Floodfill from all 4 corners
    ImageDraw.floodfill(mask_bg, (0, 0), 128)
    ImageDraw.floodfill(mask_bg, (1023, 0), 128)
    ImageDraw.floodfill(mask_bg, (0, 1023), 128)
    ImageDraw.floodfill(mask_bg, (1023, 1023), 128)

    # Build smooth antialiased alpha mask
    alpha_arr = np.where(np.array(mask_bg) == 128, 0, 255).astype(np.uint8)
    alpha_mask = Image.fromarray(alpha_arr).filter(ImageFilter.GaussianBlur(radius=0.8))
    img.putalpha(alpha_mask)

    # 2. Save master app-icon.png in root
    img.save("app-icon.png", format="PNG")
    print("app-icon.png gerado com transparência!")

    # 3. Save web icons in public/
    os.makedirs("public", exist_ok=True)
    img.resize((32, 32), Image.Resampling.LANCZOS).save("public/favicon.png", format="PNG")
    img.resize((16, 16), Image.Resampling.LANCZOS).save("public/favicon-16x16.png", format="PNG")
    img.resize((180, 180), Image.Resampling.LANCZOS).save("public/apple-touch-icon.png", format="PNG")
    img.resize((512, 512), Image.Resampling.LANCZOS).save("public/icon-512.png", format="PNG")

    # Save favicon.ico with multi-resolution
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save("public/favicon.ico", format="ICO", sizes=ico_sizes)
    print("Ícones web salvos em public/ com sucesso!")

    # Clean temporary files if any
    for tmp in ["test_transparent.png", "test_transparent_smooth.png"]:
        if os.path.exists(tmp):
            os.remove(tmp)

if __name__ == "__main__":
    main()

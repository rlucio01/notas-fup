import os
from PIL import Image

SRC_IMAGE = r"C:\Users\rafae\.gemini\antigravity-ide\brain\956d6936-7cd6-488f-ab88-7acc897e7d3b\notas_fup_app_icon_1792295996143.jpg"

def main():
    if not os.path.exists(SRC_IMAGE):
        print(f"Imagem de origem não encontrada: {SRC_IMAGE}")
        return

    img = Image.open(SRC_IMAGE)
    # Ensure RGBA
    img = img.convert("RGBA")

    # 1. Save master app-icon.png (1024x1024)
    app_icon_path = os.path.abspath("app-icon.png")
    img.save(app_icon_path, format="PNG")
    print(f"Salvo: {app_icon_path}")

    # 2. Save public web assets
    os.makedirs("public", exist_ok=True)

    img.resize((32, 32), Image.Resampling.LANCZOS).save("public/favicon.png", format="PNG")
    img.resize((16, 16), Image.Resampling.LANCZOS).save("public/favicon-16x16.png", format="PNG")
    img.resize((180, 180), Image.Resampling.LANCZOS).save("public/apple-touch-icon.png", format="PNG")
    img.resize((512, 512), Image.Resampling.LANCZOS).save("public/icon-512.png", format="PNG")

    # Save favicon.ico with multiple resolutions
    img.save("public/favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print("Ícones da web salvos em public/ com sucesso!")

if __name__ == "__main__":
    main()

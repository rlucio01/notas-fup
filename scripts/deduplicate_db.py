import os
import shutil
import sqlite3
import json
import urllib.request
import urllib.error

DB_PATH = os.path.expandvars(r"%APPDATA%\com.rlucio.notasfup\notas-fup.db")
BACKUP_PATH = os.path.expandvars(r"%APPDATA%\com.rlucio.notasfup\notas-fup.db.bak")
API_URL = "https://notas-fup-api.rlucio01.workers.dev/api/sync"
SECRET = os.environ.get("FUP_SECRET", "")

def main():
    if not os.path.exists(DB_PATH):
        print(f"Banco não encontrado: {DB_PATH}")
        return

    # 1. Create a backup first
    shutil.copy2(DB_PATH, BACKUP_PATH)
    print(f"Backup criado em: {BACKUP_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 2. Find IDs of original distinct items
    cursor.execute("""
        SELECT MIN(id) as keep_id, title, context_id, body, MIN(created_at)
        FROM items
        GROUP BY title, COALESCE(context_id, ''), COALESCE(body, '')
    """)
    keep_rows = cursor.fetchall()
    keep_ids = set(r["keep_id"] for r in keep_rows)
    print(f"Itens únicos identificados para manter: {len(keep_ids)}")

    # 3. Get total current count
    cursor.execute("SELECT COUNT(*) FROM items")
    total_before = cursor.fetchone()[0]
    print(f"Total de itens antes da limpeza: {total_before}")

    # 4. Delete duplicate items
    cursor.execute(f"""
        DELETE FROM items
        WHERE id NOT IN ({','.join('?' for _ in keep_ids)})
    """, list(keep_ids))
    deleted_items = cursor.rowcount
    print(f"Itens duplicados removidos: {deleted_items}")

    # 5. Clean orphaned item_tags
    cursor.execute("DELETE FROM item_tags WHERE item_id NOT IN (SELECT id FROM items)")
    print(f"Tags órfãs removidas: {cursor.rowcount}")

    # 6. Rebuild FTS index if exists
    try:
        cursor.execute("INSERT INTO items_fts(items_fts) VALUES('rebuild')")
        print("Índice FTS5 reconstruído com sucesso!")
    except Exception as e:
        print(f"FTS5 rebuild: {e}")

    conn.commit()

    # 7. Verify local count
    cursor.execute("SELECT COUNT(*) FROM items")
    total_after = cursor.fetchone()[0]
    print(f"Total de itens no SQLite local após limpeza: {total_after}")

    # 8. Fetch the clean items and contexts to push to Cloudflare D1
    cursor.execute("SELECT * FROM items")
    clean_items = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT * FROM contexts")
    clean_contexts = [dict(row) for row in cursor.fetchall()]

    conn.close()

    print("\nAtualizando banco remoto Cloudflare D1...")
    # Run wrangler d1 command to wipe items on remote D1 first
    os.system('npx wrangler d1 execute notas-fup-db --remote --command="DELETE FROM items;"')

    # Push clean items and contexts
    payload = json.dumps({
        "contexts": clean_contexts,
        "items": clean_items
    }).encode("utf-8")

    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SECRET}",
            "User-Agent": "NotasFUP/1.0"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(f"Cloudflare D1 sincronizado com os {len(clean_items)} itens únicos e {len(clean_contexts)} contextos!")
    except urllib.error.HTTPError as e:
        print(f"Erro ao enviar para Cloudflare: {e.code} - {e.read().decode('utf-8')}")

if __name__ == "__main__":
    main()

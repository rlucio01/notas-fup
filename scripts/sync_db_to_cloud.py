import os
import sqlite3
import json
import urllib.request
import urllib.error

DB_PATH = os.path.expandvars(r"%APPDATA%\com.rlucio.notasfup\notas-fup.db")
API_URL = "https://notas-fup-api.rlucio01.workers.dev/api/sync"
SECRET = os.environ.get("FUP_SECRET", "")

def main():
    if not os.path.exists(DB_PATH):
        print(f"Banco não encontrado em {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Fetch contexts
    cursor.execute("SELECT * FROM contexts")
    contexts = [dict(row) for row in cursor.fetchall()]
    print(f"Contextos encontrados: {len(contexts)}")

    # 2. Fetch all items
    cursor.execute("SELECT * FROM items")
    items = [dict(row) for row in cursor.fetchall()]
    print(f"Itens encontrados: {len(items)}")

    # 3. Send in batches of 100 to avoid payload limit
    batch_size = 100
    total_batches = (len(items) + batch_size - 1) // batch_size

    # First batch includes all contexts
    for batch_idx in range(total_batches):
        start = batch_idx * batch_size
        end = start + batch_size
        batch_items = items[start:end]
        batch_contexts = contexts if batch_idx == 0 else []

        payload = json.dumps({
            "contexts": batch_contexts,
            "items": batch_items
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
                print(f"Lote {batch_idx + 1}/{total_batches}: {len(batch_items)} itens enviados com sucesso!")
        except urllib.error.HTTPError as e:
            print(f"Erro no lote {batch_idx + 1}: {e.code} - {e.read().decode('utf-8')}")
            break

    print("Sincronização inicial concluída com sucesso!")

if __name__ == "__main__":
    main()

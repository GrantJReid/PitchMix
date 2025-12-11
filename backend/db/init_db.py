import sqlite3
from pathlib import Path

DB_PATH = Path("data/pitchmix.db")
SCHEMA_PATH = Path("db/schema.sql")

def main():
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    with SCHEMA_PATH.open() as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()

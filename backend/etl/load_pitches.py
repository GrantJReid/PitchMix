import csv
import sqlite3
from pathlib import Path

DB_PATH = Path("data/pitchmix.db")
CSV_DIR = Path("data/csvs")  # folder containing many CSV files


def get_or_create_pitcher(cur, mlb_id, name, throws_hand):
    cur.execute("SELECT id FROM pitchers WHERE mlb_id = ?", (mlb_id,))
    row = cur.fetchone()
    if row:
        return row[0]

    cur.execute(
        """
        INSERT INTO pitchers (mlb_id, name, throws_hand)
        VALUES (?, ?, ?)
        """,
        (mlb_id, name, throws_hand),
    )
    return cur.lastrowid


def to_int(val):
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def to_float(val):
    try:
        return float(val) if val not in ("", None) else None
    except (TypeError, ValueError):
        return None


def sanitize_header(name: str) -> str:
    return (
        name.replace("\ufeff", "")  # strip BOM
        .strip()
        .strip('"')                # strip quotes
    )


def process_csv(file_path: Path, conn: sqlite3.Connection):
    cur = conn.cursor()

    print(f"\n=== Loading CSV: {file_path.name} ===")

    with file_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        if not reader.fieldnames:
            print(f"Skipping {file_path}: No header found.")
            return

        raw_headers = reader.fieldnames
        print("Headers:", raw_headers[:10], " ...")

        header_map = {sanitize_header(fn): fn for fn in raw_headers}

        def col(name: str, fallback: str | None = None):
            if name in header_map:
                return header_map[name]
            if fallback and fallback in header_map:
                return header_map[fallback]
            return None

        pitch_type_col = col("pitch_type", "pitch_name")
        pitcher_col = col("pitcher")
        player_name_col = col("player_name")
        p_throws_col = col("p_throws")
        game_date_col = col("game_date")
        stand_col = col("stand")
        balls_col = col("balls")
        strikes_col = col("strikes")
        release_speed_col = col("release_speed")
        plate_x_col = col("plate_x")
        plate_z_col = col("plate_z")
        sz_top_col = col("sz_top")
        sz_bot_col = col("sz_bot")
        inning_col = col("inning")
        inning_tb_col = col("inning_topbot")
        description_col = col("description")
        events_col = col("events")

        # Required columns?
        if not pitcher_col or not pitch_type_col:
            print(f"Skipping {file_path}: Required columns missing.")
            return

        row_count = 0

        for row in reader:
            row_count += 1

            # Pitcher identity
            pitcher_raw = row.get(pitcher_col)
            if not pitcher_raw:
                continue

            pitcher_mlb_id = to_int(pitcher_raw)
            if pitcher_mlb_id is None:
                continue

            pitcher_name = row.get(player_name_col) or "Unknown Pitcher"
            throws_hand = row.get(p_throws_col) or ""

            pitcher_id = get_or_create_pitcher(
                cur, pitcher_mlb_id, pitcher_name, throws_hand
            )

            # Game context
            game_date = row.get(game_date_col) if game_date_col else None
            inning = to_int(row.get(inning_col)) if inning_col else None

            raw_tb = row.get(inning_tb_col)
            if raw_tb:
                t = raw_tb.strip().lower()
                if t.startswith("t"):
                    inning_topbot = "Top"
                elif t.startswith("b"):
                    inning_topbot = "Bottom"
                else:
                    inning_topbot = None
            else:
                inning_topbot = None

            batter_hand = row.get(stand_col) or None
            balls = to_int(row.get(balls_col)) if balls_col else None
            strikes = to_int(row.get(strikes_col)) if strikes_col else None

            pitch_type = row.get(pitch_type_col)
            if not pitch_type:
                continue

            # Numbers
            velocity = to_float(row.get(release_speed_col))
            plate_x = to_float(row.get(plate_x_col))
            plate_z = to_float(row.get(plate_z_col))
            sz_top = to_float(row.get(sz_top_col))
            sz_bot = to_float(row.get(sz_bot_col))

            description = row.get(description_col) or ""
            outcome = row.get(events_col) or None

            cur.execute(
                """
                INSERT INTO pitches (
                    pitcher_id, game_date, inning, top_bottom,
                    batter_hand, balls, strikes,
                    pitch_type, velocity,
                    plate_x, plate_z, sz_top, sz_bot,
                    description, outcome, runs_value
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pitcher_id,
                    game_date,
                    inning,
                    inning_topbot,
                    batter_hand,
                    balls,
                    strikes,
                    pitch_type,
                    velocity,
                    plate_x,
                    plate_z,
                    sz_top,
                    sz_bot,
                    description,
                    outcome,
                    None,  # runs_value placeholder
                ),
            )

        print(f"Finished {file_path.name}: {row_count} rows processed.")


def main():
    if not CSV_DIR.exists():
        print(f"Directory {CSV_DIR} not found.")
        return

    conn = sqlite3.connect(DB_PATH)

    csv_files = list(CSV_DIR.glob("*.csv"))
    if not csv_files:
        print("No CSV files found in data/csvs/")
        return

    print(f"Found {len(csv_files)} CSVs.")

    for file_path in csv_files:
        process_csv(file_path, conn)

    conn.commit()
    conn.close()
    print("\nAll CSVs ingested successfully.")


if __name__ == "__main__":
    main()
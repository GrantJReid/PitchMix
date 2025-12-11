CREATE TABLE IF NOT EXISTS pitchers (
    id INTEGER PRIMARY KEY,
    mlb_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    throws_hand TEXT CHECK (throws_hand IN ('L', 'R'))
);

CREATE TABLE IF NOT EXISTS pitches (
    id INTEGER PRIMARY KEY,
    pitcher_id INTEGER NOT NULL REFERENCES pitchers(id),
    game_date TEXT,
    inning INTEGER,
    top_bottom TEXT CHECK (top_bottom IN ('Top', 'Bottom')),
    batter_hand TEXT CHECK (batter_hand IN ('L', 'R')),
    balls INTEGER,
    strikes INTEGER,
    pitch_type TEXT,
    velocity REAL,
    plate_x REAL,
    plate_z REAL,
    sz_top REAL,
    sz_bot REAL,
    description TEXT,
    outcome TEXT,
    runs_value REAL
);

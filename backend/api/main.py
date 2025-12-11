from pathlib import Path
import sqlite3
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from fastapi import Query


DB_PATH = Path("data/pitchmix.db")

app = FastAPI()

# Allow the React dev server origins
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_conn():
    # Ensure data directory exists to avoid "unable to open database file"
    DB_PATH.parent.mkdir(exist_ok=True)
    return sqlite3.connect(DB_PATH)

    
@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/pitchers")
def list_pitchers():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, name, throws_hand FROM pitchers ORDER BY name")
    rows = cur.fetchall()
    conn.close()
    return [
        {"id": r[0], "name": r[1], "throws_hand": r[2]}
        for r in rows
    ]

class RecommendationRequest(BaseModel):
    pitcher_id: int
    balls: int
    strikes: int
    batter_hand: str
    last_pitch_type: str | None = None

class RecommendationRequest(BaseModel):
    pitcher_id: int
    balls: int
    strikes: int
    batter_hand: str
    last_pitch_type: str | None = None


@app.post("/api/recommendation")
def recommend_pitch(req: RecommendationRequest):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            pitch_type,
            COUNT(*) AS total,
            SUM(CASE WHEN description LIKE 'swinging_strike%' THEN 1 ELSE 0 END) AS whiffs,
            SUM(CASE WHEN outcome IN ('home_run', 'double', 'triple') THEN 1 ELSE 0 END) AS hard_hits
        FROM pitches
        WHERE pitcher_id = ?
          AND balls = ?
          AND strikes = ?
          AND batter_hand = ?
          AND pitch_type IS NOT NULL
        GROUP BY pitch_type
        HAVING total >= 5
        """,
        (req.pitcher_id, req.balls, req.strikes, req.batter_hand),
    )

    rows = cur.fetchall()

    # if no rows for that exact hand + count, fall back to all hands
    if not rows:
        cur.execute(
            """
            SELECT
                pitch_type,
                COUNT(*) AS total,
                SUM(CASE WHEN description LIKE 'swinging_strike%' THEN 1 ELSE 0 END) AS whiffs,
                SUM(CASE WHEN outcome IN ('home_run', 'double', 'triple') THEN 1 ELSE 0 END) AS hard_hits
            FROM pitches
            WHERE pitcher_id = ?
              AND balls = ?
              AND strikes = ?
              AND pitch_type IS NOT NULL
            GROUP BY pitch_type
            HAVING total >= 5
            """,
            (req.pitcher_id, req.balls, req.strikes),
        )
        rows = cur.fetchall()

    conn.close()

    if not rows:
        # Really no data; return a low-confidence default
        return {
            "recommended_pitch_type": "FF",
            "confidence": 0.5,
            "rationale": [
                "Insufficient historical data for this situation; defaulting to four-seam fastball."
            ],
            "historical_outcomes": {
                "sample_size": 0,
                "whiff_pct": 0.0,
                "in_play_hard_hit_pct": 0.0,
            },
        }

    best_pitch = None
    best_score = -999.0

    for pitch_type, total, whiffs, hard_hits in rows:
        whiff_pct = whiffs / total if total else 0.0
        hard_hit_pct = hard_hits / total if total else 0.0
        score = whiff_pct - hard_hit_pct  # simple heuristic
        if score > best_score:
            best_score = score
            best_pitch = (pitch_type, total, whiff_pct, hard_hit_pct)

    pitch_type, total, whiff_pct, hard_hit_pct = best_pitch

    return {
        "recommended_pitch_type": pitch_type,
        "confidence": min(0.95, max(0.55, best_score + 0.5)),
        "rationale": [
            f"{pitch_type} has a whiff rate of {whiff_pct:.0%} and hard-hit in-play rate of {hard_hit_pct:.0%} in similar situations.",
        ],
        "historical_outcomes": {
            "sample_size": total,
            "whiff_pct": whiff_pct,
            "in_play_hard_hit_pct": hard_hit_pct,
        },
    }

@app.get("/api/pitchers/{pitcher_id}/usage")
def pitcher_usage(
    pitcher_id: int,
    batter_hand: Optional[str] = Query(
        None, description="Filter by batter hand: 'L' or 'R'"
    ),
):
    conn = get_conn()
    cur = conn.cursor()

    params: list = [pitcher_id]
    hand_clause = ""

    # Only filter if a valid hand is provided
    if batter_hand in ("L", "R"):
        hand_clause = "AND batter_hand = ?"
        params.append(batter_hand)

    cur.execute(
        f"""
        SELECT 
            balls,
            strikes,
            pitch_type,
            COUNT(*) AS total,
            SUM(CASE WHEN description LIKE 'swinging_strike%' THEN 1 ELSE 0 END) AS whiffs,
            SUM(CASE WHEN outcome IN ('home_run', 'triple', 'double') THEN 1 ELSE 0 END) AS hard_hits
        FROM pitches
        WHERE pitcher_id = ?
          AND balls IS NOT NULL
          AND strikes IS NOT NULL
          AND pitch_type IS NOT NULL
          {hand_clause}
        GROUP BY balls, strikes, pitch_type
        ORDER BY balls, strikes, pitch_type
        """,
        params,
    )
    rows = cur.fetchall()
    conn.close()

    usage_by_count: dict[str, list[dict]] = {}
    for balls, strikes, pitch_type, total, whiffs, hard_hits in rows:
        count_key = f"{balls}-{strikes}"
        if count_key not in usage_by_count:
            usage_by_count[count_key] = []
        whiff_pct = whiffs / total if total else 0.0
        hard_hit_pct = hard_hits / total if total else 0.0
        usage_by_count[count_key].append(
            {
                "pitch_type": pitch_type,
                "total": total,
                "whiff_pct": whiff_pct,
                "hard_hit_pct": hard_hit_pct,
            }
        )

    return {"pitcher_id": pitcher_id, "usage_by_count": usage_by_count}

@app.get("/api/pitchers/{pitcher_id}/pitches")
def pitcher_pitches(
    pitcher_id: int,
    balls: int = Query(..., ge0=0, le=3, description="Balls (0–3)"),
    strikes: int = Query(..., ge0=0, le=2, description="Strikes (0–2)"),
    batter_hand: Optional[str] = Query(
        None, description="Filter by batter hand: 'L' or 'R'"
    ),
    limit: int = Query(500, ge=1, le=2000, description="Max pitches to return"),
):
    """
    Return individual pitch locations for a given pitcher and situation,
    plus average sz_top/sz_bot so the frontend can draw the strike zone.
    """
    conn = get_conn()
    cur = conn.cursor()

    params: list = [pitcher_id, balls, strikes]
    hand_clause = ""

    if batter_hand in ("L", "R"):
        hand_clause = "AND batter_hand = ?"
        params.append(batter_hand)

    cur.execute(
        f"""
        SELECT
            plate_x,
            plate_z,
            sz_top,
            sz_bot,
            pitch_type,
            description,
            outcome
        FROM pitches
        WHERE pitcher_id = ?
          AND balls = ?
          AND strikes = ?
          AND plate_x IS NOT NULL
          AND plate_z IS NOT NULL
          {hand_clause}
        LIMIT ?
        """,
        [*params, limit],
    )

    rows = cur.fetchall()
    conn.close()

    pitches = []
    sz_tops = []
    sz_bots = []

    for plate_x, plate_z, sz_top, sz_bot, pitch_type, description, outcome in rows:
        if sz_top is not None:
            sz_tops.append(sz_top)
        if sz_bot is not None:
            sz_bots.append(sz_bot)

        pitches.append(
            {
                "plate_x": plate_x,
                "plate_z": plate_z,
                "pitch_type": pitch_type,
                "description": description,
                "outcome": outcome,
            }
        )

    avg_sz_top = sum(sz_tops) / len(sz_tops) if sz_tops else None
    avg_sz_bot = sum(sz_bots) / len(sz_bots) if sz_bots else None

    return {
        "pitcher_id": pitcher_id,
        "balls": balls,
        "strikes": strikes,
        "batter_hand": batter_hand,
        "avg_sz_top": avg_sz_top,
        "avg_sz_bot": avg_sz_bot,
        "pitches": pitches,
    }

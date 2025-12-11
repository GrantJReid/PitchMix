import React, { useEffect, useState } from "react";
import PitchUsageChart, {
  UsageEntry,
} from "./components/PitchUsageChart";
import StrikeZoneChart, {
  PitchPoint,
} from "./components/StrikeZoneChart";

type Pitcher = {
  id: number;
  name: string;
  throws_hand: string;
};

type Recommendation = {
  recommended_pitch_type: string;
  confidence: number;
  rationale: string[];
  historical_outcomes: {
    sample_size: number;
    whiff_pct: number;
    in_play_hard_hit_pct: number;
  };
};

type UsageByCount = {
  [countKey: string]: UsageEntry[];
};

const App: React.FC = () => {
  const [pitchers, setPitchers] = useState<Pitcher[]>([]);
  const [selectedPitcher, setSelectedPitcher] = useState<number | "">("");
  const [loadingPitchers, setLoadingPitchers] = useState(false);

  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [usage, setUsage] = useState<UsageByCount>({});

  // situation filters
  const [balls, setBalls] = useState<number>(1);
  const [strikes, setStrikes] = useState<number>(2);
  const [batterHand, setBatterHand] = useState<"L" | "R">("L");

  // strike zone data (recommended pitch type only)
  const [pitchLocations, setPitchLocations] = useState<PitchPoint[]>([]);
  const [avgSzTop, setAvgSzTop] = useState<number | null>(null);
  const [avgSzBot, setAvgSzBot] = useState<number | null>(null);

  // usage for the *current* situation
  const currentCountKey = `${balls}-${strikes}`;
  const currentUsage = usage[currentCountKey] || [];

  // Load pitchers on mount
  useEffect(() => {
    const fetchPitchers = async () => {
      try {
        setLoadingPitchers(true);
        setError(null);
        const res = await fetch("http://localhost:8000/api/pitchers");
        if (!res.ok) {
          throw new Error(`Failed to fetch pitchers: ${res.status}`);
        }
        const data = await res.json();
        setPitchers(data);
      } catch (e: any) {
        console.error(e);
        setError(e.message || "Error loading pitchers");
      } finally {
        setLoadingPitchers(false);
      }
    };

    fetchPitchers();
  }, []);

  // Load usage whenever pitcher or batter hand changes
  useEffect(() => {
    const fetchUsage = async () => {
      if (!selectedPitcher) {
        setUsage({});
        return;
      }
      try {
        const params = new URLSearchParams();
        if (batterHand) {
          params.set("batter_hand", batterHand);
        }

        const res = await fetch(
          `http://localhost:8000/api/pitchers/${selectedPitcher}/usage?${params.toString()}`
        );
        if (!res.ok) {
          console.error("Failed to fetch usage", res.status);
          return;
        }
        const data = await res.json();
        const usageByCount: UsageByCount = data.usage_by_count || {};
        setUsage(usageByCount);
      } catch (err) {
        console.error(err);
      }
    };

    fetchUsage();
  }, [selectedPitcher, batterHand]);

  // Automatically load recommendation whenever pitcher/situation changes
  useEffect(() => {
    const fetchRecommendation = async () => {
      if (!selectedPitcher) {
        setRec(null);
        setPitchLocations([]);
        setAvgSzTop(null);
        setAvgSzBot(null);
        return;
      }

      try {
        setLoadingRec(true);
        setError(null);
        setRec(null);
        setPitchLocations([]);

        const res = await fetch("http://localhost:8000/api/recommendation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pitcher_id: selectedPitcher,
            balls,
            strikes,
            batter_hand: batterHand,
            last_pitch_type: null,
          }),
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch recommendation: ${res.status}`);
        }

        const data = await res.json();
        setRec(data);
      } catch (e: any) {
        console.error(e);
        setError(e.message || "Error loading recommendation");
      } finally {
        setLoadingRec(false);
      }
    };

    fetchRecommendation();
  }, [selectedPitcher, balls, strikes, batterHand]);

  // Load pitch locations ONLY after we have a recommendation,
  // and only keep pitches of the recommended pitch type.
  useEffect(() => {
    const fetchPitches = async () => {
      if (!selectedPitcher || !rec) {
        setPitchLocations([]);
        setAvgSzTop(null);
        setAvgSzBot(null);
        return;
      }

      try {
        const params = new URLSearchParams();
        params.set("balls", String(balls));
        params.set("strikes", String(strikes));
        if (batterHand) {
          params.set("batter_hand", batterHand);
        }

        const res = await fetch(
          `http://localhost:8000/api/pitchers/${selectedPitcher}/pitches?${params.toString()}`
        );
        if (!res.ok) {
          console.error("Failed to fetch pitch locations", res.status);
          setPitchLocations([]);
          setAvgSzTop(null);
          setAvgSzBot(null);
          return;
        }

        const data = await res.json();
        const allPitches = (data.pitches || []) as PitchPoint[];
        const recommendedType = rec.recommended_pitch_type;

        const filtered = allPitches.filter(
          (p) => p.pitch_type === recommendedType
        );

        setPitchLocations(filtered);
        setAvgSzTop(data.avg_sz_top ?? null);
        setAvgSzBot(data.avg_sz_bot ?? null);
      } catch (err) {
        console.error(err);
        setPitchLocations([]);
        setAvgSzTop(null);
        setAvgSzBot(null);
      }
    };

    fetchPitches();
  }, [selectedPitcher, balls, strikes, batterHand, rec]);

  return (
    <div style={{ padding: "1rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>PitchMix Recommender</h1>
      <p>
        Prototype Baseball Ops tool: select a pitcher and game situation to see
        pitch usage and get an interpretable pitch recommendation.
      </p>

      {error && (
        <div style={{ color: "red", marginTop: "0.5rem" }}>Error: {error}</div>
      )}

      {/* Pitcher selection */}
      <div style={{ marginTop: "1rem", marginBottom: "1rem" }}>
        <label>
          Pitcher:&nbsp;
          {loadingPitchers ? (
            <span>Loading pitchers...</span>
          ) : (
            <select
              value={selectedPitcher}
              onChange={(e) =>
                setSelectedPitcher(
                  e.target.value ? Number(e.target.value) : ""
                )
              }
            >
              <option value="">Select pitcher</option>
              {pitchers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.throws_hand})
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      {/* Situation controls */}
      <div
        style={{
          marginTop: "1rem",
          marginBottom: "1rem",
          padding: "0.75rem",
          border: "1px solid #ddd",
          borderRadius: "8px",
        }}
      >
        <h2>Situation</h2>
        <label>
          Balls:&nbsp;
          <select
            value={balls}
            onChange={(e) => setBalls(Number(e.target.value))}
          >
            {[0, 1, 2, 3].map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        &nbsp;&nbsp;
        <label>
          Strikes:&nbsp;
          <select
            value={strikes}
            onChange={(e) => setStrikes(Number(e.target.value))}
          >
            {[0, 1, 2].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        &nbsp;&nbsp;
        <label>
          Batter Hand:&nbsp;
          <select
            value={batterHand}
            onChange={(e) => setBatterHand(e.target.value as "L" | "R")}
          >
            <option value="L">L</option>
            <option value="R">R</option>
          </select>
        </label>
      </div>

      {/* optional little status */}
      {selectedPitcher && loadingRec && (
        <p style={{ marginTop: "0.5rem" }}>Updating recommendation…</p>
      )}

      {/* ---- PITCH USAGE (always stays above!) ---- */}
      <div style={{ marginTop: "2rem" }}>
        <h2>
          Pitch Usage for Count {balls}-{strikes} vs {batterHand}
        </h2>
        {Object.keys(usage).length === 0 || currentUsage.length === 0 ? (
          <p>No usage data yet for this pitcher in this situation.</p>
        ) : (
          <PitchUsageChart data={currentUsage} />
        )}
      </div>

      {/* ---- ANALYSIS SECTION (only appears after recommendation) ---- */}
      {rec && (
        <>
          {/* Recommendation card */}
          <div
            style={{
              marginTop: "2rem",
              padding: "1rem",
              border: "1px solid #ccc",
              borderRadius: "8px",
            }}
          >
            <h2>Recommended Pitch: {rec.recommended_pitch_type}</h2>
            <p>Confidence: {(rec.confidence * 100).toFixed(0)}%</p>
            <p>
              Sample size: {rec.historical_outcomes.sample_size} pitches
              <br />
              Whiff%: {(rec.historical_outcomes.whiff_pct * 100).toFixed(1)}%
              <br />
              Hard-hit in play%:{" "}
              {(
                rec.historical_outcomes.in_play_hard_hit_pct * 100
              ).toFixed(1)}
              %
            </p>
            <h3>Rationale</h3>
            <ul>
              {rec.rationale.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
          </div>

          {/* Strike Zone View – only recommended pitch type */}
          <div style={{ marginTop: "2rem" }}>
            <h2>Strike Zone View (Recommended Pitch Only)</h2>
            <p style={{ marginBottom: "0.5rem" }}>
              Locations of{" "}
              <strong>{rec.recommended_pitch_type}</strong> in this situation.
              Colored by result (whiff / hit / other).
            </p>
            <StrikeZoneChart
              pitches={pitchLocations}
              avgSzTop={avgSzTop}
              avgSzBot={avgSzBot}
              batterHand={batterHand}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default App;

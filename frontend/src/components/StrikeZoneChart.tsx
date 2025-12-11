import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Legend,
} from "recharts";

export type PitchPoint = {
  plate_x: number;
  plate_z: number;
  pitch_type: string;
  description?: string;
  outcome?: string | null;
};

type Props = {
  pitches: PitchPoint[];
  avgSzTop?: number | null;
  avgSzBot?: number | null;
  batterHand: "L" | "R";
};

// Batter silhouette, scaled to roughly match strike-zone height
const BatterSilhouette: React.FC<{ hand: "L" | "R" }> = ({ hand }) => {
  const isLHH = hand === "L";

  return (
    <div
      style={{
        position: "relative",
        width: 120,
        height: 320,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: 20,
        marginBottom: 20,
        userSelect: "none",
      }}
    >
      {/* head */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          backgroundColor: "#444",
        }}
      />

      {/* torso */}
      <div
        style={{
          width: 18,
          height: 110,
          backgroundColor: "#444",
          marginTop: 4,
        }}
      />

      {/* legs */}
      <div
        style={{
          width: 60,
          height: 120,
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
        }}
      >
        <div
          style={{
            width: 18,
            height: "100%",
            backgroundColor: "#444",
          }}
        />
        <div
          style={{
            width: 18,
            height: "100%",
            backgroundColor: "#444",
          }}
        />
      </div>

      {/* BAT – anchored at hands, resting on back shoulder */}
      <div
        style={{
          position: "absolute",
          // this y-position puts the *bottom* of the bat roughly at the hands
          top: -90,
          // x-position: behind the back shoulder depending on handedness
          left: isLHH ? 50 : "auto",
          right: isLHH ? "auto" : 50,
          width: 14,
          height: 200,
          backgroundColor: "#7b4a12",
          borderRadius: 7,
          // pivot at bottom so it looks like the hitter is holding the knob
          transformOrigin: "bottom center",
          transform: isLHH ? "rotate(32deg)" : "rotate(-32deg)",
        }}
      />

      {/* label */}
      <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600 }}>
        {isLHH ? "LHH" : "RHH"}
      </div>
    </div>
  );
};

const StrikeZoneChart: React.FC<Props> = ({ pitches, batterHand }) => {
  if (!pitches || pitches.length === 0) {
    return <p>No pitch location data for this situation.</p>;
  }

  // Strike zone boundaries (catcher's view)
  const zoneLeft = -0.83;
  const zoneRight = 0.83;
  const zoneBot = 1.5;
  const zoneTop = 3.5;

  const xDomain: [number, number] = [-1.2, 1.2];
  const yDomain: [number, number] = [1.0, 4.0];

  const filtered = pitches.filter(
    (p) =>
      p.plate_x >= xDomain[0] &&
      p.plate_x <= xDomain[1] &&
      p.plate_z >= yDomain[0] &&
      p.plate_z <= yDomain[1]
  );

  if (filtered.length === 0) {
    return <p>No pitches in this zone window.</p>;
  }

  // Color grouping
  const whiff: PitchPoint[] = [];
  const hit: PitchPoint[] = [];
  const other: PitchPoint[] = [];

  for (const p of filtered) {
    const desc = (p.description || "").toLowerCase();
    const outcome = (p.outcome || "").toLowerCase();

    const isWhiff =
      desc.startsWith("swinging_strike") || desc === "foul_tip";
    const isHit = ["single", "double", "triple", "home_run"].includes(outcome);

    if (isWhiff) whiff.push(p);
    else if (isHit) hit.push(p);
    else other.push(p);
  }

  const chartBox = (
    <div style={{ width: 350, height: 420 }}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 20, right: 10, bottom: 40, left: 50 }}>
          <CartesianGrid />

          <XAxis
            type="number"
            dataKey="plate_x"
            domain={xDomain}
            label={{
              value: "Inside ←  Plate X  → Outside",
              position: "bottom",
              offset: 0,
            }}
          />

          <YAxis
            type="number"
            dataKey="plate_z"
            domain={yDomain}
            label={{
              value: "Height (ft)",
              angle: -90,
              position: "insideLeft",
            }}
          />

          <Tooltip />

          <Legend verticalAlign="top" />

          <ReferenceArea
            x1={zoneLeft}
            x2={zoneRight}
            y1={zoneBot}
            y2={zoneTop}
            fill="rgba(0,0,0,0.08)"
            stroke="#111"
          />

          {whiff.length > 0 && (
            <Scatter name="Whiff" data={whiff} fill="#1eb33b" />
          )}
          {hit.length > 0 && (
            <Scatter name="Hit in Play" data={hit} fill="#d63b3b" />
          )}
          {other.length > 0 && (
            <Scatter name="Other" data={other} fill="#888888" />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "2rem",
      }}
    >
      {batterHand === "R" && <BatterSilhouette hand="R" />}
      {chartBox}
      {batterHand === "L" && <BatterSilhouette hand="L" />}
    </div>
  );
};

export default StrikeZoneChart;

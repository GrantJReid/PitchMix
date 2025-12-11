import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export type UsageEntry = {
  pitch_type: string;
  total: number;
  whiff_pct: number;
  hard_hit_pct: number;
};

type Props = {
  data: UsageEntry[];
};

const PitchUsageChart: React.FC<Props> = ({ data }) => {
  if (!data || data.length === 0) {
    return <p>No usage data for this count.</p>;
  }

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <XAxis dataKey="pitch_type" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="total" name="Total pitches" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PitchUsageChart;
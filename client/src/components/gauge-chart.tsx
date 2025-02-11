import { PieChart, Pie, Cell } from "recharts";

interface GaugeProps {
  score: number;
  size?: number;
}

const RADIAN = Math.PI / 180;
const COLORS = {
  'Very Poor': '#FF4136',
  'Poor': '#FF851B',
  'Fair': '#FFDC00',
  'Good': '#2ECC40',
  'Excellent': '#01FF70'
};

const getScoreLabel = (score: number) => {
  if (score <= 20) return 'Very Poor';
  if (score <= 40) return 'Poor';
  if (score <= 60) return 'Fair';
  if (score <= 80) return 'Good';
  return 'Excellent';
};

export default function GaugeChart({ score, size = 200 }: GaugeProps) {
  const data = [
    { name: 'score', value: score },
    { name: 'remainder', value: 100 - score }
  ];

  const scoreLabel = getScoreLabel(score);
  const color = COLORS[scoreLabel as keyof typeof COLORS];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie
          data={data}
          cx={size / 2}
          cy={size / 2}
          startAngle={180}
          endAngle={0}
          innerRadius={(size / 2) * 0.8}
          outerRadius={size / 2}
          cornerRadius={5}
          paddingAngle={0}
          dataKey="value"
        >
          <Cell fill={color} />
          <Cell fill="#EAEAEA" />
        </Pie>
      </PieChart>
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ top: '35%' }}
      >
        <div className="text-4xl font-bold">{score}</div>
        <div className="text-sm font-medium text-muted-foreground">{scoreLabel}</div>
      </div>
    </div>
  );
}

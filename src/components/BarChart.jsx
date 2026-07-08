import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const DEFAULT_COLORS = ['#59be8a', '#4ea47a', '#418c68', '#357457', '#2a5e48']

export default function BarChart({ data, colorByValue = false }) {
  if (!data.length) {
    return <div className="rounded-lg border border-[var(--line)] p-6 text-sm text-[var(--muted)]">No data yet.</div>
  }

  return (
    <div className="h-[280px] rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data} margin={{ top: 10, right: 14, left: -14, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis dataKey="label" stroke="var(--muted)" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} stroke="var(--muted)" tick={{ fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: 'rgba(89,190,138,0.12)' }}
            contentStyle={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              color: 'var(--text)',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="value" name="Completion %" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => {
              const color = colorByValue
                ? entry.value >= 80
                  ? '#59be8a'
                  : entry.value >= 50
                    ? '#efc06f'
                    : '#f48f88'
                : DEFAULT_COLORS[index % DEFAULT_COLORS.length]

              return <Cell key={entry.key || entry.label} fill={color} />
            })}
          </Bar>
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  )
}

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export default function LineChart({ data }) {
  if (!data.length) {
    return <div className="rounded-lg border border-[var(--line)] p-6 text-sm text-[var(--muted)]">No data yet.</div>
  }

  return (
    <div className="h-[300px] rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
      <ResponsiveContainer width="100%" height="100%">
        <ReLineChart data={data} margin={{ top: 10, right: 14, left: -14, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis dataKey="label" stroke="var(--muted)" tick={{ fontSize: 12 }} minTickGap={18} />
          <YAxis domain={[0, 100]} stroke="var(--muted)" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              color: 'var(--text)',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="value"
            name="Completion %"
            stroke="#59be8a"
            strokeWidth={3}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  )
}

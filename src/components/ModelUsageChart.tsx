"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

import styles from "./ModelUsageChart.module.scss"

interface ModelUsageChartProps {
  model: string
  displayName: string
  data: Array<{ date: string; [key: string]: number | string }>
  color: string
}

export function ModelUsageChart({
  model,
  displayName,
  data,
  color,
}: ModelUsageChartProps) {
  const chartData = data.map((d) => ({ date: d.date, usage: d[model] ?? 0 }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.customTooltip}>
          <strong>{label}</strong>
          <div>Credits: {payload[0].value}</div>
        </div>
      )
    }
    return null
  }

  return (
    <div>
      <h3>{displayName}</h3>
      <div className={styles.chartContainer}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              ticks={
                chartData.length > 0
                  ? [chartData[0].date, chartData[chartData.length - 1].date]
                  : []
              }
            />
            <YAxis
              label={{
                value: "Credits",
                angle: -90,
                position: "insideLeft",
              }}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "#00000010" }}
            />
            <Bar dataKey="usage" fill={color} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

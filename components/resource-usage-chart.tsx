"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

interface ChartData {
  name: string
  value: number
}

interface ResourceUsageChartProps {
  data: ChartData[]
  type: "cpu" | "memory"
}

export function ResourceUsageChart({ data, type }: ResourceUsageChartProps) {
  // Sort data by value in descending order and take top 5
  const sortedData = [...data].sort((a, b) => b.value - a.value).slice(0, 5)

  // If there are more than 5 namespaces, add an "Others" category
  if (data.length > 5) {
    const othersValue = data.slice(5).reduce((acc, item) => acc + item.value, 0)

    sortedData.push({
      name: "Others",
      value: othersValue,
    })
  }

  // Filter out zero values
  const filteredData = sortedData.filter((item) => item.value > 0)

  // If all values are zero, show a message
  if (filteredData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }

  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--chart-6))",
  ]

  const formatValue = (value: number) => {
    return type === "cpu" ? `${value}m` : `${value}Mi`
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={filteredData} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value">
          {filteredData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => [formatValue(value), type === "cpu" ? "CPU Usage" : "Memory Usage"]} />
        <Legend formatter={(value) => <span className="text-sm">{value}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}

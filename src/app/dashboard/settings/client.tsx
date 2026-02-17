"use client"

import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Label } from "@/components/ui/Label"
import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { getModelDisplayName } from "@/lib/models/registry"

import styles from "./page.module.scss"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { ModelUsageChart } from "@/components/ModelUsageChart"

interface OrganizationData {
  creditBalance: number
  tier: {
    maxMonthlyCreditSpend: number
    models: Record<
      string,
      {
        maxConcurrentGenerations: number
        maxDailyGenerations: number
      }
    >
  }
  usage: {
    models: Record<
      string,
      {
        dailyGenerations: number
      }
    >
  }
}

interface UsageData {
  results: Array<{
    date: string
    usedCredits: Array<{
      model: string
      amount: number
    }>
  }>
  models: string[]
}

export default function SettingsClient() {
  const [name, setName] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [organizationData, setOrganizationData] =
    useState<OrganizationData | null>(null)
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const isSupportedModel = (model: string) => !model.startsWith("eleven_")

  const filteredUsageData = useMemo(() => {
    if (!usageData) return null
    return {
      models: usageData.models.filter(isSupportedModel),
      results: usageData.results.map((r) => ({
        ...r,
        usedCredits: r.usedCredits.filter((c) => isSupportedModel(c.model)),
      })),
    }
  }, [usageData])

  const chartData = useMemo(() => {
    if (!filteredUsageData) return []
    const dataMap: Record<string, { date: string; [key: string]: string | number }> = {}
    filteredUsageData.results.forEach(({ date, usedCredits }) => {
      dataMap[date] = { date }
      usedCredits.forEach(({ model, amount }) => {
        dataMap[date][model] = amount
      })
    })
    filteredUsageData.models.forEach((model) => {
      Object.values(dataMap).forEach((dayData) => {
        if (!(model in dayData)) {
          dayData[model] = 0
        }
      })
    })
    return Object.values(dataMap).sort(
      (a, b) =>
        new Date(a.date as string).getTime() -
        new Date(b.date as string).getTime(),
    )
  }, [filteredUsageData])

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean
    payload?: Array<{ dataKey: string; value: number }>
    label?: string
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.customTooltip}>
          <strong>{`${label}`}</strong>
          <p>{`Total: ${payload.reduce((acc, pld) => acc + pld.value, 0)}`}</p>
          {payload.map((pld) => (
            <p key={pld.dataKey}>
              {`${getModelDisplayName(pld.dataKey)}: ${pld.value}`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const fetchUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      setName(user.user_metadata?.name || "")
      setApiKey(user.user_metadata?.runway_api_key || "")
    }
  }

  const fetchCredits = async () => {
    setError(null)
    if (!apiKey) return

    try {
      const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]

      const res = await fetch(
        `/api/organization?startDate=${startDate}&endDate=${endDate}`,
      )
      if (!res.ok) {
        throw new Error(`Failed to fetch data: ${res.status}`)
      }
      const data = await res.json()
      setOrganizationData(data.organization)
      setUsageData(data.usage)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
        toast.error(err.message)
      } else {
        setError("An unknown error occurred")
        toast.error("An unknown error occurred")
      }
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  useEffect(() => {
    if (apiKey) {
      fetchCredits()
    } else {
      setOrganizationData(null)
      setUsageData(null)
    }
  }, [apiKey])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({
      data: { name, runway_api_key: apiKey },
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Settings updated.")
      fetchCredits()
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>User Settings</h1>
      <form className={styles.settingsForm} onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="name">User Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="api-key">Runway API Key</Label>
          <Input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <Button type="submit">Save</Button>
        <Button
          variant="ghost"
          onClick={async () => {
            await supabase.auth.signOut()
            router.push("/login")
          }}
        >
          Logout
        </Button>
      </form>

      {apiKey ? (
        <>
          {/* Credits Remaining */}
          <div>
            <h2>Credits Remaining</h2>
            {error ? (
              <p>Error: {error}</p>
            ) : (
              <p>{organizationData?.creditBalance ?? "Loading..."}</p>
            )}
          </div>

          {/* Credit Usage Chart */}
          <div>
            <h2>Credit Usage Past 30 Days</h2>
            {error ? (
              <p>Error: {error}</p>
            ) : filteredUsageData ? (
              <div className={styles.chartContainer}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      ticks={
                        chartData.length > 0
                          ? [
                              chartData[0].date as string,
                              chartData[chartData.length - 1].date as string,
                            ]
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
                    <Legend
                      formatter={(value) => getModelDisplayName(value as string)}
                    />
                    {filteredUsageData.models.sort().map((model, index) => (
                      <Bar
                        key={model}
                        dataKey={model}
                        stackId="a"
                        fill={`hsl(${(index * 137) % 360}, 70%, 50%)`}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p>Loading...</p>
            )}
          </div>

          {/* Credit Usage per Model Charts */}
          <div>
            <h2>Credit Usage per Model Past 30 Days</h2>
            {error ? (
              <p>Error: {error}</p>
            ) : filteredUsageData ? (
              <div className={styles.modelCharts}>
                {filteredUsageData.models.sort().map((model, index) => (
                  <ModelUsageChart
                    key={model}
                    model={model}
                    displayName={getModelDisplayName(model)}
                    data={chartData}
                    color={`hsl(${(index * 137) % 360}, 70%, 50%)`}
                  />
                ))}
              </div>
            ) : (
              <p>Loading...</p>
            )}
          </div>

          {/* Daily Usage Table */}
          <div>
            <h2>Daily API Calls</h2>
            {error ? (
              <p>Error: {error}</p>
            ) : organizationData ? (
              <table className={styles.usageTable}>
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Max Daily Generations Limit</th>
                    <th>Used Today</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(organizationData.usage.models)
                    .filter(isSupportedModel)
                    .sort()
                    .map((model) => (
                      <tr key={model}>
                        <td>{getModelDisplayName(model)}</td>
                        <td>
                          {organizationData.tier.models[model]
                            ?.maxDailyGenerations > 0
                            ? organizationData.tier.models[model]
                                .maxDailyGenerations
                            : "Unlimited"}
                        </td>
                        <td>
                          {organizationData.usage.models[model]
                            ?.dailyGenerations ?? 0}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p>Loading...</p>
            )}
          </div>
        </>
      ) : (
        <p>Set API Key to view credits and usage.</p>
      )}
    </div>
  )
}

"use client"

import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Label } from "@/components/ui/Label"
import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

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

  // Models in human readable format
  const modelNames = {
    upscale_v1: "Upscale V1",
    act_two: "Act-Two",
    gen4_image: "Gen-4 Image",
    gen4_image_turbo: "Gen-4 Image Turbo",
    gen4_turbo: "Gen-4 Turbo",
    gen4_aleph: "Gen-4 Aleph",
    // veo3: "Veo 3",
    // gemini_2.5_flash: "Gemini 2.5 Flash",
  }

  const chartData = useMemo(() => {
    if (!usageData) return []
    const dataMap: Record<string, any> = {}
    usageData.results.forEach(({ date, usedCredits }) => {
      dataMap[date] = { date }
      usedCredits.forEach(({ model, amount }) => {
        dataMap[date][model] = amount
      })
    })
    usageData.models.forEach((model) => {
      Object.values(dataMap).forEach((dayData: any) => {
        if (!(model in dayData)) {
          dayData[model] = 0
        }
      })
    })
    return Object.values(dataMap).sort(
      (a: any, b: any) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    )
  }, [usageData])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.customTooltip}>
          <strong>{`${label}`}</strong>
          <p>{`Total: ${payload.reduce((acc: number, pld: any) => acc + pld.value, 0)}`}</p>
          {payload.map((pld: any) => (
            <p key={pld.dataKey}>
              {`${modelNames[pld.dataKey as keyof typeof modelNames] || pld.dataKey}: ${pld.value}`}
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
      // Tomorrow
      const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      // 30 days ago
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]

      const res = await fetch(
        // `/api/organization`,
        `/api/organization?startDate=${startDate}&endDate=${endDate}`,
      )
      if (!res.ok) {
        throw new Error(`Failed to fetch data: ${res.status}`)
      }
      const data = await res.json()
      setOrganizationData(data.organization)
      setUsageData(data.usage)
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
        toast.error(error.message)
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
      fetchCredits() // Refresh credits after update
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
            ) : usageData ? (
              <div className={styles.chartContainer}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      ticks={chartData.length > 0 ? [chartData[0].date, chartData[chartData.length - 1].date] : []} 
                    />
                    <YAxis
                      label={{
                        value: "Credits",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#00000010" }} />
                    <Legend
                      formatter={(value) =>
                        modelNames[value as keyof typeof modelNames] || value
                      }
                    />
                    {usageData.models.sort().map((model, index) => (
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

          {/* Credit Usage per Model Charts*/}
          <div>
            <h2>Credit Usage per Model Past 30 Days</h2>
            {error ? (
              <p>Error: {error}</p>
            ) : usageData ? (
              <div className={styles.modelCharts}>
                {usageData.models.sort().map((model, index) => (
                  <ModelUsageChart
                    key={model}
                    model={model}
                    displayName={modelNames[model as keyof typeof modelNames] || model}
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
                    .sort()
                    .map((model) => (
                      <tr key={model}>
                        <td>{modelNames[model as keyof typeof modelNames]}</td>
                        <td>
                          {organizationData.tier.models[model]
                            .maxDailyGenerations > 0
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

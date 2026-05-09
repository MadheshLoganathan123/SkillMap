"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TrendingUp, CheckCircle2, Circle, Loader2, ArrowRight, Trophy, Target, Calendar } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

interface ProgressItem {
  id: string
  week_index: number
  skill_name: string
  completed: boolean
  completed_at: string | null
}

interface Week {
  week: number
  skills: string[]
}

interface Roadmap {
  id: string
  weeks: Week[]
}

export default function ProgressPage() {
  const [loading, setLoading] = useState(true)
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [progress, setProgress] = useState<ProgressItem[]>([])
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryTarget, setRetryTarget] = useState<ProgressItem | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      console.log("Loading progress data for user:", user.id)

      // Fetch from backend API
      const response = await fetch(`http://localhost:8000/progress/${user.id}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log("Progress data:", data)
        
        if (data.progress && data.progress.length > 0) {
          setProgress(data.progress)
          
          // Reconstruct roadmap from progress data
          const weeklyData: Record<number, string[]> = {}
          data.progress.forEach((p: ProgressItem) => {
            if (!weeklyData[p.week_index]) {
              weeklyData[p.week_index] = []
            }
            if (!weeklyData[p.week_index].includes(p.skill_name)) {
              weeklyData[p.week_index].push(p.skill_name)
            }
          })
          
          const weeks = Object.entries(weeklyData).map(([index, skills]) => ({
            week: parseInt(index) + 1,
            skills
          }))
          
          setRoadmap({
            id: data.roadmap_id,
            weeks
          })
        }
      } else {
        console.error("Failed to fetch progress:", response.status)
      }
    } catch (err) {
      console.error("Error loading data:", err)
      setError(err instanceof Error ? err.message : 'Failed to load progress data')
    } finally {
      setLoading(false)
    }
  }

  async function toggleSkillCompletion(progressItem: ProgressItem) {
    setUpdating(progressItem.id)
    setError(null)
    setRetryTarget(null)

    const maxAttempts = 2
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const newCompleted = !progressItem.completed

        console.log(`PATCH attempt ${attempt} for progress ${progressItem.id}`)

        const res = await fetch('/api/progress', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ progressId: progressItem.id, completed: newCompleted })
        })

        const json = await res.json().catch(() => ({}))

        if (!res.ok) {
          console.warn(`Server returned ${res.status} on attempt ${attempt}`, json)
          if (attempt < maxAttempts) {
            // brief backoff before retry
            await new Promise(r => setTimeout(r, 300 * attempt))
            continue
          }
          throw new Error(json?.error || `Server error (${res.status})`)
        }

        const updated = json.progress

        setProgress(prev =>
          prev.map(p =>
            p.id === progressItem.id
              ? { ...p, completed: updated.completed, completed_at: updated.completed_at }
              : p
          )
        )

        // success
        setError(null)
        setRetryTarget(null)
        break
      } catch (err) {
        console.error(`Attempt ${attempt} failed for ${progressItem.id}:`, err)
        if (attempt === maxAttempts) {
          const msg = err instanceof Error ? err.message : 'Failed to update progress'
          setError(msg)
          setRetryTarget(progressItem)
        } else {
          // short delay before retry
          await new Promise(r => setTimeout(r, 200 * attempt))
        }
      }
    }

    setUpdating(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-100vh">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!roadmap || progress.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No Roadmap Found
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Generate a learning roadmap first to start tracking your progress.
            </p>
            <Link href="/roadmap">
              <Button size="lg" className="gap-2">
                Generate Roadmap
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const completedCount = progress.filter(p => p.completed).length
  const totalCount = progress.length
  const progressPercentage = Math.round((completedCount / totalCount) * 100)

  // Group progress by week
  const weeklyProgress: Record<number, ProgressItem[]> = {}
  progress.forEach(p => {
    if (!weeklyProgress[p.week_index]) {
      weeklyProgress[p.week_index] = []
    }
    weeklyProgress[p.week_index].push(p)
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Track Progress</h1>
        <p className="text-muted-foreground mt-1">
          Monitor your learning journey and check off skills as you master them.
        </p>
        {error && (
          <div className="mt-4">
            <Alert variant="destructive">
              <AlertDescription>
                {error}
                <div className="mt-3 flex items-center justify-center">
                  <Button size="sm" onClick={() => {
                    if (retryTarget) {
                      setError(null)
                      // retry the same toggle action
                      toggleSkillCompletion(retryTarget)
                    } else {
                      setError(null)
                    }
                  }}>
                    Retry
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>

      {/* Overall Progress Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${progressPercentage * 2.83} 283`}
                  className="text-accent transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-foreground">
                  {progressPercentage}%
                </span>
                <span className="text-xs text-muted-foreground">Complete</span>
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-bold text-foreground mb-2">
                {progressPercentage === 100 ? (
                  <span className="flex items-center justify-center md:justify-start gap-2">
                    <Trophy className="w-6 h-6 text-chart-5" />
                    Congratulations! All skills completed!
                  </span>
                ) : progressPercentage >= 50 ? (
                  "Great progress! Keep it up!"
                ) : (
                  "You&apos;re on your way!"
                )}
              </h2>
              <p className="text-muted-foreground mb-4">
                You&apos;ve completed {completedCount} of {totalCount} skills in your learning roadmap.
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="w-3 h-3 text-accent" />
                  {completedCount} Completed
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Circle className="w-3 h-3 text-muted-foreground" />
                  {totalCount - completedCount} Remaining
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Progress */}
      <div className="space-y-4">
        {Object.entries(weeklyProgress).map(([weekIndex, items]) => {
          const weekNum = parseInt(weekIndex) + 1
          const weekCompleted = items.filter(i => i.completed).length
          const weekTotal = items.length
          const isWeekComplete = weekCompleted === weekTotal
          
          return (
            <Card key={weekIndex} className={isWeekComplete ? "border-accent/50 bg-accent/5" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isWeekComplete ? "bg-accent text-accent-foreground" : "bg-muted"
                    }`}>
                      {isWeekComplete ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Calendar className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg">Week {weekNum}</CardTitle>
                      <CardDescription>
                        {weekCompleted} of {weekTotal} skills completed
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={isWeekComplete ? "default" : "secondary"}>
                    {Math.round((weekCompleted / weekTotal) * 100)}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        item.completed 
                          ? "bg-accent/10 border-accent/30" 
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        checked={item.completed}
                        onCheckedChange={() => toggleSkillCompletion(item)}
                        disabled={updating === item.id}
                        className="data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                      />
                      <div className="flex-1">
                        <span className={`font-medium ${
                          item.completed ? "text-muted-foreground line-through" : "text-foreground"
                        }`}>
                          {item.skill_name}
                        </span>
                        {item.completed_at && (
                          <p className="text-xs text-muted-foreground">
                            Completed {new Date(item.completed_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {updating === item.id && (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

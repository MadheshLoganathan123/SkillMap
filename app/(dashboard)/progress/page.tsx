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

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    
    try {
      // Get latest roadmap
      const { data: latestRoadmap } = await supabase
        .from("roadmaps")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single()
      
      if (latestRoadmap) {
        setRoadmap(latestRoadmap)
        
        // Get progress for this roadmap
        const { data: progressData } = await supabase
          .from("progress")
          .select("*")
          .eq("roadmap_id", latestRoadmap.id)
          .order("week_index", { ascending: true })
        
        if (progressData) {
          setProgress(progressData)
        }
      }
    } catch (err) {
      console.error("Error loading data:", err)
    } finally {
      setLoading(false)
    }
  }

  async function toggleSkillCompletion(progressItem: ProgressItem) {
    setUpdating(progressItem.id)
    const supabase = createClient()
    
    try {
      const newCompleted = !progressItem.completed
      const { error } = await supabase
        .from("progress")
        .update({
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null
        })
        .eq("id", progressItem.id)
      
      if (error) throw error
      
      setProgress(prev =>
        prev.map(p =>
          p.id === progressItem.id
            ? { ...p, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
            : p
        )
      )
    } catch (err) {
      console.error("Error updating progress:", err)
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
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

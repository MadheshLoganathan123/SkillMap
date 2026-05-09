"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Map, Calendar, BookOpen, Loader2, ArrowRight, CheckCircle2, Clock, ExternalLink, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

interface Week {
  week: number
  skills: string[]
  resources: { title: string; url: string; type: string }[]
  duration_weeks?: number
  description?: string
  learning_objectives?: string[]
  project_ideas?: string[]
}

interface Roadmap {
  id: string
  weeks: Week[]
  analysis_id: string
}

interface Analysis {
  id: string
  missing_skills: string[]
  match_score: number
}

// Learning resources database
const skillResources: Record<string, { title: string; url: string; type: string }[]> = {
  "TypeScript": [
    { title: "TypeScript Handbook", url: "https://www.typescriptlang.org/docs/", type: "Documentation" },
    { title: "TypeScript Deep Dive", url: "https://basarat.gitbook.io/typescript/", type: "Book" }
  ],
  "Next.js": [
    { title: "Next.js Documentation", url: "https://nextjs.org/docs", type: "Documentation" },
    { title: "Next.js Tutorial", url: "https://nextjs.org/learn", type: "Course" }
  ],
  "React": [
    { title: "React Documentation", url: "https://react.dev/", type: "Documentation" },
    { title: "React Patterns", url: "https://reactpatterns.com/", type: "Guide" }
  ],
  "GraphQL": [
    { title: "GraphQL Learn", url: "https://graphql.org/learn/", type: "Documentation" },
    { title: "How to GraphQL", url: "https://www.howtographql.com/", type: "Course" }
  ],
  "AWS": [
    { title: "AWS Training", url: "https://aws.amazon.com/training/", type: "Course" },
    { title: "AWS Documentation", url: "https://docs.aws.amazon.com/", type: "Documentation" }
  ],
  "Docker": [
    { title: "Docker Getting Started", url: "https://docs.docker.com/get-started/", type: "Documentation" },
    { title: "Docker Tutorial", url: "https://docker-curriculum.com/", type: "Tutorial" }
  ],
  "Kubernetes": [
    { title: "Kubernetes Documentation", url: "https://kubernetes.io/docs/home/", type: "Documentation" },
    { title: "Kubernetes Tutorial", url: "https://kubernetes.io/docs/tutorials/", type: "Tutorial" }
  ],
  "Python": [
    { title: "Python Documentation", url: "https://docs.python.org/3/", type: "Documentation" },
    { title: "Real Python", url: "https://realpython.com/", type: "Tutorial" }
  ],
  "Machine Learning": [
    { title: "ML Course by Andrew Ng", url: "https://www.coursera.org/learn/machine-learning", type: "Course" },
    { title: "Scikit-learn Documentation", url: "https://scikit-learn.org/stable/", type: "Documentation" }
  ]
}

function getDefaultResources(skill: string) {
  return skillResources[skill] || [
    { title: `Learn ${skill}`, url: `https://www.google.com/search?q=learn+${encodeURIComponent(skill)}`, type: "Search" },
    { title: `${skill} Tutorial`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(skill)}+tutorial`, type: "Video" }
  ]
}

function generateRoadmapWeeks(missingSkills: string[]): Week[] {
  const weeks: Week[] = []
  const skillsPerWeek = 2
  
  for (let i = 0; i < missingSkills.length; i += skillsPerWeek) {
    const weekSkills = missingSkills.slice(i, i + skillsPerWeek)
    const resources = weekSkills.flatMap(skill => getDefaultResources(skill))
    
    weeks.push({
      week: Math.floor(i / skillsPerWeek) + 1,
      skills: weekSkills,
      resources
    })
  }
  
  return weeks
}

export default function RoadmapPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const analysisId = searchParams.get("analysisId")
  
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [analysisId])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError("Please sign in to view your roadmap.")
        setLoading(false)
        return
      }

      // Fetch roadmap data from backend
      const response = await fetch(`http://localhost:8000/dashboard/${user.id}`)
      
      if (response.ok) {
        const data = await response.json()

        // Always set analysis data if gaps exist (even if roadmap isn't persisted yet)
        if (data.gaps) {
          setAnalysis({
            id: data.roadmap?.analysis_id || 'backend-generated',
            missing_skills: data.gaps.missing_skills || [],
            match_score: data.profile?.match_score || 0
          })
        }

        // If roadmap exists in backend, use it
        if (data.roadmap) {
          const backendRoadmap = data.roadmap
          let finalWeeks: Week[] = []
          
          // Try to extract weeks from the roadmap
          if (backendRoadmap.weeks && Array.isArray(backendRoadmap.weeks) && backendRoadmap.weeks.length > 0) {
            // Process each week and ensure it has resources
            finalWeeks = backendRoadmap.weeks.map((week: any) => {
              const processedWeek: Week = {
                week: week.week || 1,
                skills: Array.isArray(week.skills) ? week.skills : [],
                resources: [],
                duration_weeks: week.duration_weeks,
                description: week.description,
                learning_objectives: week.learning_objectives,
                project_ideas: week.project_ideas
              }
              
              // Add resources for each skill if not present
              if (!week.resources || week.resources.length === 0) {
                processedWeek.resources = processedWeek.skills.flatMap(skill => getDefaultResources(skill))
              } else {
                processedWeek.resources = week.resources
              }
              
              return processedWeek
            })
          } else if (backendRoadmap.roadmap && Array.isArray(backendRoadmap.roadmap) && backendRoadmap.roadmap.length > 0) {
            // Convert roadmap steps to weeks
            finalWeeks = backendRoadmap.roadmap.map((item: any, index: number) => ({
              week: item.step || index + 1,
              skills: [item.skill],
              resources: getDefaultResources(item.skill),
              duration_weeks: item.duration_weeks,
              description: item.description,
              learning_objectives: item.learning_objectives,
              project_ideas: item.project_ideas
            }))
          }
          
          if (finalWeeks.length > 0) {
            setRoadmap({
              id: backendRoadmap.id || 'generated',
              weeks: finalWeeks,
              analysis_id: backendRoadmap.analysis_id || 'backend-generated'
            })
          } else {
            setError("Roadmap data is invalid. Please regenerate your assessment.")
          }
        } else {
          // If backend hasn't saved a roadmap yet, still show a generated one from gaps.
          // This prevents a blank roadmap page when the quiz submission succeeded but persistence failed.
          const missingSkills = data?.gaps?.missing_skills
          if (Array.isArray(missingSkills) && missingSkills.length > 0) {
            const weeks = generateRoadmapWeeks(missingSkills)
            setRoadmap({
              id: "client-generated",
              weeks,
              analysis_id: "client-generated"
            })
          }
        }
      } else {
        await response.text().catch(() => null)
        setError("Failed to load roadmap data")
      }
    } catch (err) {
      setError("An error occurred while loading your roadmap")
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateRoadmap() {
    if (!analysis) return
    
    setGenerating(true)
    const supabase = createClient()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const weeks = generateRoadmapWeeks(analysis.missing_skills as string[])
      
      const { data: newRoadmap, error: dbError } = await supabase
        .from("roadmaps")
        .insert({
          user_id: user.id,
          analysis_id: analysis.id,
          weeks
        })
        .select()
        .single()
      
      if (dbError) throw dbError

      // Create progress entries for each skill
      const progressEntries = weeks.flatMap((week, weekIndex) =>
        week.skills.map(skill => ({
          user_id: user.id,
          roadmap_id: newRoadmap.id,
          week_index: weekIndex,
          skill_name: skill,
          completed: false
        }))
      )

      await supabase.from("progress").insert(progressEntries)
      
      setRoadmap(newRoadmap)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate roadmap")
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!analysis && !roadmap) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Map className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No Roadmap Yet
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Complete your career assessment on the dashboard to automatically generate your personalized learning roadmap.
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/dashboard">
                <Button size="lg" className="gap-2">
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" onClick={loadData} className="gap-2">
                <Loader2 className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Learning Roadmap</h1>
        <p className="text-muted-foreground mt-1">
          Your personalized week-by-week plan to master the skills you need.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!roadmap ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <Map className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Roadmap Not Generated Yet
            </h3>
            <p className="text-muted-foreground mb-6">
              Complete your career assessment on the dashboard to automatically generate your roadmap.
            </p>
            <Link href="/dashboard">
              <Button className="gap-2">
                <ArrowRight className="w-4 h-4" />
                Go to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Timeline */}
          <div className="space-y-6">
            {(roadmap.weeks as Week[]).map((week, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Week {week.week}</CardTitle>
                      <CardDescription>
                        Focus: {week.skills.join(", ")}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Description if available */}
                  {week.description && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-sm text-muted-foreground">{week.description}</p>
                    </div>
                  )}

                  {/* Skills for this week */}
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2">Skills to Learn</h4>
                    <div className="flex flex-wrap gap-2">
                      {week.skills.map((skill, idx) => (
                        <Badge key={idx} variant="outline" className="gap-1">
                          <Clock className="w-3 h-3" />
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Learning Objectives */}
                  {week.learning_objectives && week.learning_objectives.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2">Learning Objectives</h4>
                      <ul className="space-y-1">
                        {week.learning_objectives.map((obj, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex gap-2">
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            {obj}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Project Ideas */}
                  {week.project_ideas && week.project_ideas.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2">Project Ideas</h4>
                      <ul className="space-y-1">
                        {week.project_ideas.map((project, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex gap-2">
                            <Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                            {project}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Resources */}
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2">Learning Resources</h4>
                    <div className="space-y-2">
                      {week.resources.map((resource, idx) => (
                        <a
                          key={idx}
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <BookOpen className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">{resource.title}</span>
                            <Badge variant="secondary" className="text-xs">
                              {resource.type}
                            </Badge>
                          </div>
                          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                        </a>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-4">
            <Link href="/progress">
              <Button className="gap-2">
                Track Your Progress
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

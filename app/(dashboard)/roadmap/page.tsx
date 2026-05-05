"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Map, Calendar, BookOpen, Loader2, ArrowRight, CheckCircle2, Clock, ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

interface Week {
  week: number
  skills: string[]
  resources: { title: string; url: string; type: string }[]
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
      // First, get the latest analysis if no analysisId provided
      let targetAnalysisId = analysisId
      
      if (!targetAnalysisId) {
        const { data: latestAnalysis } = await supabase
          .from("analyses")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .single()
        
        if (latestAnalysis) {
          targetAnalysisId = latestAnalysis.id
          setAnalysis(latestAnalysis)
        }
      } else {
        const { data: analysisData } = await supabase
          .from("analyses")
          .select("*")
          .eq("id", targetAnalysisId)
          .single()
        
        if (analysisData) {
          setAnalysis(analysisData)
        }
      }

      // Check if roadmap exists for this analysis
      if (targetAnalysisId) {
        const { data: existingRoadmap } = await supabase
          .from("roadmaps")
          .select("*")
          .eq("analysis_id", targetAnalysisId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single()
        
        if (existingRoadmap) {
          setRoadmap(existingRoadmap)
        }
      }
    } catch (err) {
      console.error("Error loading data:", err)
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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Map className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No Analysis Found
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Complete a skill gap analysis first to generate your personalized learning roadmap.
            </p>
            <Link href="/upload">
              <Button size="lg" className="gap-2">
                Start Analysis
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
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
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <Map className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Generate Your Roadmap
            </h3>
            <p className="text-muted-foreground mb-4">
              Based on your analysis, you need to learn {(analysis.missing_skills as string[]).length} skills.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {(analysis.missing_skills as string[]).map((skill, idx) => (
                <Badge key={idx} variant="secondary">{skill}</Badge>
              ))}
            </div>
            <Button onClick={handleGenerateRoadmap} disabled={generating} className="gap-2">
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Map className="w-4 h-4" />
                  Generate Roadmap
                </>
              )}
            </Button>
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

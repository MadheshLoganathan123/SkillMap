import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Upload, Map, TrendingUp, BarChart3, ArrowRight, Target, Clock, CheckCircle2 } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Fetch user's latest analysis
  const { data: analyses } = await supabase
    .from("analyses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)

  // Fetch user's roadmaps
  const { data: roadmaps } = await supabase
    .from("roadmaps")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)

  // Fetch progress if roadmap exists
  let completedSkills = 0
  let totalSkills = 0
  if (roadmaps && roadmaps.length > 0) {
    const { data: progress } = await supabase
      .from("progress")
      .select("*")
      .eq("roadmap_id", roadmaps[0].id)

    if (progress) {
      totalSkills = progress.length
      completedSkills = progress.filter(p => p.completed).length
    }
  }

  const latestAnalysis = analyses?.[0]
  const latestRoadmap = roadmaps?.[0]
  const progressPercentage = totalSkills > 0 ? Math.round((completedSkills / totalSkills) * 100) : 0

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back, {user?.user_metadata?.full_name?.split(" ")[0] || "there"}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Track your skill development journey and close your career gaps.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Match Score</p>
                <p className="text-2xl font-bold text-foreground">
                  {latestAnalysis ? `${latestAnalysis.match_score}%` : "--"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Skills to Learn</p>
                <p className="text-2xl font-bold text-foreground">
                  {latestAnalysis?.missing_skills ? 
                    (latestAnalysis.missing_skills as string[]).length : "--"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-chart-3/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-chart-3" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="text-2xl font-bold text-foreground">
                  {totalSkills > 0 ? `${progressPercentage}%` : "--"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Cards */}
      {!latestAnalysis ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Start Your First Analysis
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Upload your resume and a target job description to discover your skill gaps 
              and get a personalized learning roadmap.
            </p>
            <Link href="/upload">
              <Button size="lg" className="gap-2">
                Upload Resume
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Latest Analysis Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Latest Analysis
              </CardTitle>
              <CardDescription>
                Your most recent skill gap analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Match Score</span>
                <span className="text-lg font-semibold text-foreground">
                  {latestAnalysis.match_score}%
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${latestAnalysis.match_score}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-sm text-muted-foreground">Existing Skills</p>
                  <p className="text-lg font-semibold text-chart-3">
                    {(latestAnalysis.existing_skills as string[])?.length || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Missing Skills</p>
                  <p className="text-lg font-semibold text-destructive">
                    {(latestAnalysis.missing_skills as string[])?.length || 0}
                  </p>
                </div>
              </div>
              <Link href="/upload" className="block pt-2">
                <Button variant="outline" className="w-full gap-2">
                  New Analysis
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Roadmap Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="w-5 h-5 text-accent" />
                Learning Roadmap
              </CardTitle>
              <CardDescription>
                Your personalized skill development plan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {latestRoadmap ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Overall Progress</span>
                    <span className="text-lg font-semibold text-foreground">
                      {completedSkills}/{totalSkills} skills
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Link href="/roadmap" className="flex-1">
                      <Button variant="outline" className="w-full gap-2">
                        View Roadmap
                        <Map className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link href="/progress" className="flex-1">
                      <Button className="w-full gap-2">
                        Track Progress
                        <TrendingUp className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">
                    Generate a roadmap from your analysis to start tracking progress.
                  </p>
                  <Link href="/roadmap">
                    <Button className="gap-2">
                      Generate Roadmap
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

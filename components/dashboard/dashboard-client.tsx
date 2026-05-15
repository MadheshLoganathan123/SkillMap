"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useDashboard } from "@/context/dashboard-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { 
  Upload, 
  Map, 
  Target, 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  FileText, 
  Award, 
  Layout, 
  Globe,
  ExternalLink,
  ChevronRight,
  MessageSquare,
  Trophy,
  Rocket,
  Send,
  ArrowRight,
  X
} from "lucide-react"
import Link from "next/link"

interface DashboardProps {
  user: any
}

export default function DashboardClient({ user }: DashboardProps) {
  const { 
    resumeData, 
    quizAnswers, 
    careerProfile, 
    loading, 
    setResumeData, 
    setQuizAnswers, 
    submitAssessment 
  } = useDashboard()
  
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [selectedProject, setSelectedProject] = useState<{name: string, description: string} | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      await handleUpload(selectedFile)
    }
  }

  const handleUpload = async (uploadFile: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("user_id", user.id)

      const response = await fetch("http://localhost:8000/upload-resume", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error("Failed to upload resume")

      const data = await response.json()
      if (data.success) {
        setResumeData(data.structured_data)
        toast.success("Resume processed successfully!")
      }
    } catch (err) {
      console.error(err)
      toast.error("Error processing resume")
    } finally {
      setUploading(false)
    }
  }

  const handleAnswerChange = (question: string, value: string) => {
    setQuizAnswers({ ...quizAnswers, [question]: value })
  }

  const handleSubmit = async () => {
    if (!resumeData) {
      toast.error("Please upload your resume first")
      return
    }
    
    const success = await submitAssessment()
    if (success) {
      toast.success("Assessment submitted! Redirecting to your roadmap...")
      setTimeout(() => {
        router.push("/roadmap")
      }, 2000)
    } else {
      toast.error("Failed to submit assessment. Please try again.")
    }
  }

  const skillPlatforms = [
    { name: "Coursera", url: "https://www.coursera.org", icon: Globe },
    { name: "Udemy", url: "https://www.udemy.com", icon: Layout },
    { name: "LinkedIn Learning", url: "https://www.linkedin.com/learning", icon: Award },
    { name: "Khan Academy", url: "https://www.khanacademy.org", icon: Award },
  ]

  const questions = [
    "What is your target role?",
    "How many years of experience do you have?",
    "What are your top 3 career goals for this year?",
    "What is your preferred work environment (Remote, Hybrid, On-site)?",
    "Are you looking for an entry-level, mid-senior, or executive role?"
  ]

  const isQuizComplete = questions.every(q => quizAnswers[q] && quizAnswers[q].length > 0)

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {user?.user_metadata?.full_name?.split(" ")[0] || "there"}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Your career cockpit: Analyze, learn, and grow.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf"
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading || loading} className="gap-2">
            {(uploading || loading) ? <Clock className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {resumeData ? "Update Resume" : "Upload Resume"}
          </Button>
          <Link href="/upload">
            <Button variant="outline" className="gap-2">
              <Target className="w-4 h-4" />
              Analyze Skill Gap
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Stats & Analysis */}
        <div className="md:col-span-2 space-y-6">
          {/* Stats Row */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Match Score Card */}
            <Card className={`${
              (careerProfile?.match_score || 0) >= 70 ? 'bg-green-500/5 border-green-500/20' :
              (careerProfile?.match_score || 0) >= 40 ? 'bg-yellow-500/5 border-yellow-500/20' :
              'bg-red-500/5 border-red-500/20'
            }`}>
              <CardContent className="p-6">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className={`w-6 h-6 ${
                        (careerProfile?.match_score || 0) >= 70 ? 'text-green-500' :
                        (careerProfile?.match_score || 0) >= 40 ? 'text-yellow-500' :
                        'text-red-500'
                      }`} />
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Match Score</p>
                    </div>
                  </div>
                  <p className="text-3xl font-bold">{careerProfile?.match_score?.toFixed(1) || "--"}%</p>
                  <div className="w-full bg-muted rounded-full h-2 mt-1">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${
                        (careerProfile?.match_score || 0) >= 70 ? 'bg-green-500' :
                        (careerProfile?.match_score || 0) >= 40 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${careerProfile?.match_score || 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(careerProfile?.match_score || 0) >= 70 ? 'Excellent match!' :
                     (careerProfile?.match_score || 0) >= 40 ? 'Good foundation' :
                     'Build more skills'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Ready to Apply Card */}
            <Card className={`${
              (careerProfile?.readiness_percentage || 0) >= 80 ? 'bg-accent/10 border-accent/30' :
              (careerProfile?.readiness_percentage || 0) >= 50 ? 'bg-blue-500/5 border-blue-500/20' :
              'bg-orange-500/5 border-orange-500/20'
            }`}>
              <CardContent className="p-6">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Rocket className={`w-6 h-6 ${
                        (careerProfile?.readiness_percentage || 0) >= 80 ? 'text-accent' :
                        (careerProfile?.readiness_percentage || 0) >= 50 ? 'text-blue-500' :
                        'text-orange-500'
                      }`} />
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Ready to Apply</p>
                    </div>
                  </div>
                  <p className="text-3xl font-bold">{careerProfile?.readiness_percentage?.toFixed(1) || "--"}%</p>
                  <div className="w-full bg-muted rounded-full h-2 mt-1">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${
                        (careerProfile?.readiness_percentage || 0) >= 80 ? 'bg-accent' :
                        (careerProfile?.readiness_percentage || 0) >= 50 ? 'bg-blue-500' :
                        'bg-orange-500'
                      }`}
                      style={{ width: `${careerProfile?.readiness_percentage || 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(careerProfile?.readiness_percentage || 0) >= 80 ? 'Start applying!' :
                     (careerProfile?.readiness_percentage || 0) >= 50 ? 'Almost there' :
                     'Keep learning'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Target Role Card */}
            <Card className="bg-chart-3/5 border-chart-3/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-chart-3" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Target Role</p>
                    <p className="text-sm font-bold truncate max-w-[120px]">{careerProfile?.target_role || "Not Set"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analysis View (Extracted from Resume) */}
          {resumeData ? (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Top Skills & Tech
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {resumeData.skills?.map((skill: string) => (
                    <Badge key={skill} variant="secondary">{skill}</Badge>
                  ))}
                  {resumeData.technologies?.map((tech: string) => (
                    <Badge key={tech} variant="outline" className="border-accent text-accent">{tech}</Badge>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="w-4 h-4 text-chart-4" />
                    Key Achievements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {resumeData.achievements?.map((ach: string, i: number) => (
                      <li key={i} className="text-sm flex gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-chart-4 mt-1.5 shrink-0" />
                        {ach}
                      </li>
                    ))}
                    {(!resumeData.achievements || resumeData.achievements.length === 0) && (
                      <li className="text-sm text-muted-foreground italic">No achievements identified. Try a more descriptive resume.</li>
                    )}
                  </ul>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Layout className="w-5 h-5 text-chart-2" />
                    Notable Projects
                  </CardTitle>
                  <CardDescription>
                    {resumeData.projects && resumeData.projects.length > 0 
                      ? `${resumeData.projects.length} project${resumeData.projects.length > 1 ? 's' : ''} in your portfolio`
                      : 'Your projects will appear here'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {resumeData.projects && resumeData.projects.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {resumeData.projects.map((project: any, i: number) => {
                        const projectName = typeof project === 'string' ? project : project.name
                        const projectDesc = typeof project === 'string' ? '' : project.description
                        
                        return (
                          <div 
                            key={i} 
                            className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors group"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-2 h-2 rounded-full bg-chart-2 shrink-0" />
                              <p className="text-base font-semibold text-foreground">
                                {projectName}
                              </p>
                            </div>
                            {projectDesc && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedProject({ name: projectName, description: projectDesc })}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                      <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                        <Layout className="w-10 h-10 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm text-muted-foreground font-medium mb-2">
                        No projects identified
                      </p>
                      <p className="text-xs text-muted-foreground max-w-md">
                        Make sure your resume has a "PROJECTS" section with project titles.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Project Details Modal */}
              <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                      <Layout className="w-5 h-5 text-chart-2" />
                      {selectedProject?.name}
                    </DialogTitle>
                    <DialogDescription className="text-base leading-relaxed mt-4">
                      {selectedProject?.description}
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <Card className="border-dashed py-12">
              <CardContent className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">No Data Yet</h3>
                <p className="text-muted-foreground max-w-sm mt-2 mb-6">
                  Upload your resume to see your skills, achievements, and projects visualized here.
                </p>
                <Button onClick={() => fileInputRef.current?.click()} variant="secondary">
                  Upload Resume to Get Started
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Questionnaire Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Career Readiness Quiz
              </CardTitle>
              <CardDescription>
                Answer these questions to help us tailor your roadmap and job recommendations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {questions.map((q, i) => (
                <div key={i} className="space-y-3">
                  <p className="text-sm font-medium">{q}</p>
                  <input 
                    type="text" 
                    placeholder="Type your answer..." 
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={quizAnswers[q] || ""}
                    onChange={(e) => handleAnswerChange(q, e.target.value)}
                  />
                </div>
              ))}
              <div className="pt-4 border-t">
                <Button 
                  onClick={handleSubmit} 
                  disabled={!isQuizComplete || !resumeData || loading} 
                  className="w-full gap-2 py-6 text-lg font-bold"
                >
                  {loading ? <Clock className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  Submit Career Assessment
                </Button>
                {!resumeData && <p className="text-xs text-destructive text-center mt-2 font-medium">Please upload a resume first.</p>}
                {!isQuizComplete && resumeData && <p className="text-xs text-muted-foreground text-center mt-2">Complete all questions to unlock your roadmap.</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Roadmap & Platforms */}
        <div className="space-y-6">
          {/* Roadmap Card */}
          <Card className="overflow-hidden border-accent/20">
            <div className="h-2 bg-accent" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="w-5 h-5 text-accent" />
                Your Roadmap
              </CardTitle>
              <CardDescription>Targeting: {careerProfile?.target_role || "Pending..."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Progress</span>
                  <span>{careerProfile?.readiness_percentage?.toFixed(1) || 0}%</span>
                </div>
                <Progress value={careerProfile?.readiness_percentage || 0} className="h-2" />
              </div>
              <div className="space-y-3">
                {careerProfile ? (
                  <p className="text-sm text-muted-foreground">
                    Your learning path has been generated based on your profile and target role.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Submit your assessment to generate your roadmap.
                  </p>
                )}
              </div>
              <Link href="/roadmap" className="block pt-2">
                <Button variant="outline" className="w-full group">
                  View Full Path
                  <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Platforms Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Skill Development Hub</CardTitle>
              <CardDescription>External resources to boost your profile</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {skillPlatforms.map((platform) => (
                <a 
                  key={platform.name}
                  href={platform.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <platform.icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{platform.name}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </CardContent>
          </Card>

          {/* Quick Tip */}
          <Card className="bg-chart-4/10 border-chart-4/20 border-none shadow-none">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="shrink-0 w-10 h-10 rounded-full bg-chart-4/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-chart-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-chart-4">AI Coach Tip</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    "Tailoring your achievements with action verbs like 'Optimized' or 'Spearheaded' significantly increases your visibility to recruiters."
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

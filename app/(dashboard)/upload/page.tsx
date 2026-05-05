"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileText, Briefcase, Loader2, Sparkles, CheckCircle2, XCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AnalysisResults } from "@/components/dashboard/analysis-results"

interface AnalysisResult {
  id: string
  matchScore: number
  existingSkills: string[]
  missingSkills: string[]
  skillScores: Record<string, number>
}

export default function UploadPage() {
  const [resume, setResume] = useState("")
  const [jobDescription, setJobDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const router = useRouter()

  const handleAnalyze = async () => {
    if (!resume.trim() || !jobDescription.trim()) {
      setError("Please provide both your resume and the job description.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jobDescription }),
      })

      if (!response.ok) {
        throw new Error("Failed to analyze. Please try again.")
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateRoadmap = () => {
    if (result) {
      router.push(`/roadmap?analysisId=${result.id}`)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Upload & Analyze</h1>
        <p className="text-muted-foreground mt-1">
          Paste your resume and a job description to identify your skill gaps.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!result ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Resume Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Your Resume
              </CardTitle>
              <CardDescription>
                Paste your resume text or key skills and experience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="resume">Resume Content</Label>
                <Textarea
                  id="resume"
                  placeholder="Paste your resume here...

Example:
Software Engineer with 5 years of experience in web development. Proficient in JavaScript, React, Node.js, and PostgreSQL. Experience with agile methodologies and team leadership."
                  className="min-h-[300px] resize-none"
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Job Description Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-accent" />
                Target Job Description
              </CardTitle>
              <CardDescription>
                Paste the job description you want to apply for
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="jobDescription">Job Description</Label>
                <Textarea
                  id="jobDescription"
                  placeholder="Paste the job description here...

Example:
We are looking for a Senior Full-Stack Developer with experience in TypeScript, React, Next.js, and cloud services (AWS/GCP). Knowledge of GraphQL and microservices architecture is a plus."
                  className="min-h-[300px] resize-none"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <AnalysisResults 
          result={result} 
          onGenerateRoadmap={handleGenerateRoadmap}
          onNewAnalysis={() => {
            setResult(null)
            setResume("")
            setJobDescription("")
          }}
        />
      )}

      {!result && (
        <div className="flex justify-center">
          <Button 
            size="lg" 
            onClick={handleAnalyze} 
            disabled={loading || !resume.trim() || !jobDescription.trim()}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Analyze Skill Gap
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

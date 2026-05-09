"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileText, Briefcase, Loader2, Sparkles, Upload as UploadIcon, X } from "lucide-react"
import { AnalysisResults } from "@/components/dashboard/analysis-results"

interface AnalysisResult {
  id: string
  matchScore: number
  existingSkills: string[]
  missingSkills: string[]
  skillScores: Record<string, number>
  achievements?: string[]
  projects?: string[]
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [jobDescription, setJobDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.type !== "application/pdf") {
        setError("Please upload a PDF file.")
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleAnalyze = async () => {
    if (!file || !jobDescription.trim()) {
      setError("Please provide both your resume (PDF) and the job description.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("job_description", jobDescription)

      // Pointing to the FastAPI backend
      const response = await fetch("http://localhost:8000/process-resume", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to analyze. Ensure the backend is running.")
      }

      const data = await response.json()
      
      // Map FastAPI response to the frontend's expected format
      const matchScore = data.gap_analysis?.match_percentage || 0
      const existingSkills = data.gap_analysis?.shared_skills || []
      const missingSkills = data.gap_analysis?.missing_skills || []
      
      setResult({
        id: Math.random().toString(36).substring(7),
        matchScore: Math.round(matchScore),
        existingSkills: existingSkills,
        missingSkills: missingSkills,
        skillScores: existingSkills.reduce((acc: any, skill: string) => ({ ...acc, [skill]: 90 }), {}),
        achievements: data.resume_analysis?.achievements || [],
        projects: data.resume_analysis?.projects || []
      })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "An error occurred connecting to the backend.")
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
          Upload your resume PDF and paste a job description to identify your skill gaps.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!result ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Resume Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Your Resume
              </CardTitle>
              <CardDescription>
                Upload your resume in PDF format
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Label htmlFor="resume-upload" className="sr-only">Upload Resume</Label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    file ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    id="resume-upload"
                    className="hidden"
                    accept=".pdf"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  {file ? (
                    <div className="flex flex-col items-center">
                      <FileText className="w-10 h-10 text-primary mb-2" />
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-2 text-destructive hover:text-destructive/80"
                        onClick={(e) => {
                          e.stopPropagation()
                          setFile(null)
                        }}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <UploadIcon className="w-10 h-10 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">Click to upload or drag and drop</p>
                      <p className="text-xs text-muted-foreground">PDF only (max 5MB)</p>
                    </div>
                  )}
                </div>
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
                  placeholder="Paste the job description here..."
                  className="min-h-50 resize-none"
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
            setFile(null)
            setJobDescription("")
          }}
        />
      )}

      {!result && (
        <div className="flex justify-center">
          <Button 
            size="lg" 
            onClick={handleAnalyze} 
            disabled={loading || !file || !jobDescription.trim()}
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

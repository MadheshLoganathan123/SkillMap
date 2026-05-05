"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Target } from "lucide-react"

interface AnalysisResult {
  id: string
  matchScore: number
  existingSkills: string[]
  missingSkills: string[]
  skillScores: Record<string, number>
}

interface AnalysisResultsProps {
  result: AnalysisResult
  onGenerateRoadmap: () => void
  onNewAnalysis: () => void
}

export function AnalysisResults({ result, onGenerateRoadmap, onNewAnalysis }: AnalysisResultsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-chart-3"
    if (score >= 60) return "text-chart-5"
    if (score >= 40) return "text-chart-3"
    return "text-destructive"
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent Match"
    if (score >= 60) return "Good Match"
    if (score >= 40) return "Moderate Match"
    return "Needs Improvement"
  }

  return (
    <div className="space-y-6">
      {/* Match Score Card */}
      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative w-40 h-40">
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
                  strokeDasharray={`${result.matchScore * 2.83} 283`}
                  className="text-primary transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-4xl font-bold ${getScoreColor(result.matchScore)}`}>
                  {result.matchScore}%
                </span>
                <span className="text-sm text-muted-foreground">Match</span>
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {getScoreLabel(result.matchScore)}
              </h2>
              <p className="text-muted-foreground mb-4">
                Based on our analysis, you have {result.existingSkills.length} matching skills 
                and need to develop {result.missingSkills.length} additional skills for this role.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="w-3 h-3 text-chart-3" />
                  {result.existingSkills.length} Skills Match
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="w-3 h-3 text-destructive" />
                  {result.missingSkills.length} Skills Needed
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skills Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Existing Skills */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-chart-3">
              <CheckCircle2 className="w-5 h-5" />
              Your Matching Skills
            </CardTitle>
            <CardDescription>
              Skills you already have that match the job requirements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.existingSkills.length > 0 ? (
                result.existingSkills.map((skill, index) => (
                  <Badge key={index} variant="outline" className="border-chart-3/30 bg-chart-3/10 text-chart-3">
                    {skill}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No matching skills found.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Missing Skills */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              Skills to Develop
            </CardTitle>
            <CardDescription>
              Skills mentioned in the job that you need to learn
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.missingSkills.length > 0 ? (
                result.missingSkills.map((skill, index) => (
                  <Badge key={index} variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                    {skill}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Great! You have all the required skills.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Skill Scores */}
      {Object.keys(result.skillScores).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Skill Proficiency Estimate
            </CardTitle>
            <CardDescription>
              Estimated proficiency levels based on your resume
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(result.skillScores).map(([skill, score]) => (
                <div key={skill} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground font-medium">{skill}</span>
                    <span className="text-muted-foreground">{score}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button variant="outline" onClick={onNewAnalysis} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          New Analysis
        </Button>
        {result.missingSkills.length > 0 && (
          <Button onClick={onGenerateRoadmap} className="gap-2">
            Generate Learning Roadmap
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, BarChart3, Map, CheckCircle2, ArrowRight, Sparkles, Target, TrendingUp } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <nav className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Target className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">SkillMap</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button>Get Started</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              AI-Powered Career Development
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 text-balance leading-tight">
              Bridge Your Skill Gaps with{" "}
              <span className="text-primary">Intelligent Analysis</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 text-pretty">
              Upload your resume, compare it against job descriptions, and get personalized 
              learning roadmaps to land your dream role.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/sign-up">
                <Button size="lg" className="gap-2">
                  Start Free Analysis
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button size="lg" variant="outline">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Upload & Analyze</h3>
                <p className="text-muted-foreground">
                  Upload your resume and paste any job description. Our AI analyzes both to identify your skill gaps instantly.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <Map className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Learning Roadmap</h3>
                <p className="text-muted-foreground">
                  Get a personalized week-by-week learning plan with curated resources to master the skills you need.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-chart-3/10 flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-chart-3" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Track Progress</h3>
                <p className="text-muted-foreground">
                  Monitor your learning journey with visual progress tracking. Check off skills as you master them.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            How It Works
          </h2>
          <div className="space-y-8">
            {[
              {
                step: "1",
                title: "Upload Your Resume",
                description: "Paste your resume text or upload a document. Our AI extracts your current skills and experience."
              },
              {
                step: "2", 
                title: "Add Target Job Description",
                description: "Paste the job description of your dream role. We identify required skills and compare them with yours."
              },
              {
                step: "3",
                title: "Get Your Skill Gap Analysis",
                description: "See a detailed breakdown of your match score, existing skills, and the gaps you need to fill."
              },
              {
                step: "4",
                title: "Follow Your Learning Roadmap",
                description: "Receive a personalized week-by-week plan with resources to master each missing skill."
              }
            ].map((item, index) => (
              <div key={index} className="flex gap-6 items-start">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <span className="text-primary-foreground font-bold">{item.step}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Ready to Accelerate Your Career?
          </h2>
          <p className="text-muted-foreground mb-8">
            Join thousands of professionals who have transformed their careers with SkillMap.
          </p>
          <Link href="/auth/sign-up">
            <Button size="lg" className="gap-2">
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Target className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">SkillMap</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Built with AI to help you reach your career goals.
          </p>
        </div>
      </footer>
    </div>
  )
}

"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

interface DashboardState {
  resumeData: any | null
  quizAnswers: Record<string, string>
  careerProfile: any | null
  skillGaps: any | null
  roadmap: any | null
  loading: boolean
  syncDashboard: () => Promise<void>
  setResumeData: (data: any) => void
  setQuizAnswers: (answers: Record<string, string>) => void
  submitAssessment: () => Promise<boolean>
}

const DashboardContext = createContext<DashboardState | undefined>(undefined)

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [resumeData, setResumeData] = useState<any | null>(null)
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({})
  const [careerProfile, setCareerProfile] = useState<any | null>(null)
  const [skillGaps, setSkillGaps] = useState<any | null>(null)
  const [roadmap, setRoadmap] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const syncDashboard = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    try {
      // Fetch dashboard data
      const response = await fetch(`http://localhost:8000/dashboard/${user.id}`)
      if (!response.ok) throw new Error("Failed to fetch dashboard data")

      const data = await response.json()
      if (data.resume) setResumeData(data.resume.structured_data)
      if (data.quiz) setQuizAnswers(data.quiz.answers)
      if (data.profile) setCareerProfile(data.profile)
      if (data.gaps) setSkillGaps(data.gaps)
      if (data.roadmap) setRoadmap(data.roadmap)

      // Also fetch progress to update readiness
      const progressResponse = await fetch(`http://localhost:8000/progress/${user.id}`)
      if (progressResponse.ok) {
        const progressData = await progressResponse.json()
        if (progressData.stats && progressData.stats.readiness) {
          // Update career profile with latest readiness
          setCareerProfile((prev: any) => prev ? {
            ...prev,
            readiness_percentage: progressData.stats.readiness
          } : null)
        }
      }
    } catch (err) {
      console.error("Sync error:", err)
    } finally {
      setLoading(false)
    }
  }, [])

useEffect(() => {
  syncDashboard()
}, [syncDashboard])

const submitAssessment = async () => {
  setLoading(true)
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !resumeData) {
    console.error("Cannot submit: user or resumeData missing", { user: !!user, resumeData: !!resumeData })
    setLoading(false)
    return false
  }

  try {
    console.log("=== Starting assessment submission ===")

    // 1. Save Quiz Answers first
    console.log("Saving quiz answers...")
    const quizFormData = new FormData()
    quizFormData.append("user_id", user.id)
    quizFormData.append("answers", JSON.stringify(quizAnswers))

    const quizResponse = await fetch("http://localhost:8000/save-quiz", {
      method: "POST",
      body: quizFormData
    })
    console.log("Quiz save response:", quizResponse.status)

    // 2. Generate Career Profile
    const targetRole = quizAnswers["What is your target role?"] || "Full Stack Developer"
    console.log("Generating career profile for role:", targetRole)
    console.log("User skills:", resumeData.skills)

    const profileFormData = new FormData()
    profileFormData.append("user_id", user.id)
    profileFormData.append("target_role", targetRole)
    profileFormData.append("skills", JSON.stringify(resumeData.skills || []))

    console.log("Calling /generate-career-profile endpoint...")
    const response = await fetch("http://localhost:8000/generate-career-profile", {
      method: "POST",
      body: profileFormData
    })

    console.log("Career profile response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Career profile generation failed:", errorText)
      throw new Error("Failed to generate career profile")
    }

    const result = await response.json()
    console.log("Career profile result:", result)

    if (result.success) {
      console.log("✓ Career profile generated successfully")
      setCareerProfile(result.profile)
      setSkillGaps(result.gaps)
      setRoadmap(result.roadmap)
      return true
    } else {
      console.error("✗ Career profile generation returned success=false")
      return false
    }
  } catch (err) {
    console.error("✗ Submission error:", err)
    return false
  } finally {
    setLoading(false)
  }
}

return (
  <DashboardContext.Provider value={{
    resumeData,
    quizAnswers,
    careerProfile,
    skillGaps,
    roadmap,
    loading,
    syncDashboard,
    setResumeData,
    setQuizAnswers,
    submitAssessment
  }}>
    {children}
  </DashboardContext.Provider>
)
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider")
  }
  return context
}

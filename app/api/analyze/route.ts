import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Helper function to extract skills from text
function extractSkills(text: string): string[] {
  const skillPatterns = [
    // Programming Languages
    "JavaScript", "TypeScript", "Python", "Java", "C\\+\\+", "C#", "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "Scala", "R",
    // Frontend
    "React", "Vue", "Angular", "Next\\.js", "Nuxt", "Svelte", "HTML", "CSS", "Sass", "SCSS", "Tailwind", "Bootstrap", "jQuery",
    // Backend
    "Node\\.js", "Express", "Django", "Flask", "FastAPI", "Spring", "Rails", "Laravel", "ASP\\.NET", "NestJS",
    // Databases
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "DynamoDB", "Cassandra", "SQLite", "SQL Server", "Oracle",
    // Cloud & DevOps
    "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "CI/CD", "Jenkins", "GitHub Actions", "GitLab CI",
    // Tools & Concepts
    "Git", "REST API", "GraphQL", "Microservices", "Agile", "Scrum", "TDD", "Linux", "Webpack", "Vite",
    // Data & AI
    "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "Pandas", "NumPy", "Data Analysis", "NLP", "Computer Vision",
    // Other
    "Figma", "UI/UX", "Product Management", "Leadership", "Communication", "Problem Solving"
  ]

  const foundSkills: string[] = []
  const lowerText = text.toLowerCase()

  for (const skill of skillPatterns) {
    const regex = new RegExp(`\\b${skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (regex.test(lowerText)) {
      // Clean up the skill name for display
      const cleanSkill = skill.replace(/\\\./g, '.').replace(/\\\+/g, '+')
      foundSkills.push(cleanSkill)
    }
  }

  return [...new Set(foundSkills)]
}

// Helper to calculate match score
function calculateMatchScore(existingSkills: string[], requiredSkills: string[]): number {
  if (requiredSkills.length === 0) return 100
  const matchedCount = existingSkills.filter(skill => 
    requiredSkills.some(req => req.toLowerCase() === skill.toLowerCase())
  ).length
  return Math.round((matchedCount / requiredSkills.length) * 100)
}

// Generate skill proficiency scores based on resume mentions
function generateSkillScores(resume: string, skills: string[]): Record<string, number> {
  const scores: Record<string, number> = {}
  const lowerResume = resume.toLowerCase()
  
  for (const skill of skills) {
    // Count mentions and context to estimate proficiency
    const regex = new RegExp(skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const matches = lowerResume.match(regex) || []
    const baseScore = Math.min(100, 40 + matches.length * 15)
    
    // Check for experience indicators
    const experienceIndicators = ['years', 'experience', 'expert', 'senior', 'lead', 'proficient']
    const skillContext = lowerResume.includes(skill.toLowerCase())
    const hasExperienceContext = experienceIndicators.some(ind => 
      lowerResume.includes(`${skill.toLowerCase()} ${ind}`) || 
      lowerResume.includes(`${ind} ${skill.toLowerCase()}`)
    )
    
    scores[skill] = hasExperienceContext ? Math.min(100, baseScore + 20) : baseScore
  }
  
  return scores
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { resume, jobDescription } = await request.json()

    if (!resume || !jobDescription) {
      return NextResponse.json(
        { error: "Resume and job description are required" },
        { status: 400 }
      )
    }

    // Extract skills from both documents
    const resumeSkills = extractSkills(resume)
    const jobSkills = extractSkills(jobDescription)

    // Find matching and missing skills
    const existingSkills = resumeSkills.filter(skill =>
      jobSkills.some(jobSkill => jobSkill.toLowerCase() === skill.toLowerCase())
    )
    const missingSkills = jobSkills.filter(skill =>
      !resumeSkills.some(resumeSkill => resumeSkill.toLowerCase() === skill.toLowerCase())
    )

    // Calculate match score
    const matchScore = calculateMatchScore(existingSkills, jobSkills)

    // Generate skill proficiency scores
    const skillScores = generateSkillScores(resume, existingSkills)

    // Save analysis to database
    const { data: analysis, error: dbError } = await supabase
      .from("analyses")
      .insert({
        user_id: user.id,
        resume_text: resume,
        job_description: jobDescription,
        match_score: matchScore,
        existing_skills: existingSkills,
        missing_skills: missingSkills,
        skill_scores: skillScores,
      })
      .select()
      .single()

    if (dbError) {
      console.error("Database error:", dbError)
      return NextResponse.json(
        { error: "Failed to save analysis" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: analysis.id,
      matchScore,
      existingSkills,
      missingSkills,
      skillScores,
    })
  } catch (error) {
    console.error("Analysis error:", error)
    return NextResponse.json(
      { error: "An error occurred during analysis" },
      { status: 500 }
    )
  }
}

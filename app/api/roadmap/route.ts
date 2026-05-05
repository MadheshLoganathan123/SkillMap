import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { analysisId, missingSkills } = await request.json()

    if (!missingSkills || !Array.isArray(missingSkills) || missingSkills.length === 0) {
      return NextResponse.json({ error: 'Missing skills are required' }, { status: 400 })
    }

    // Generate a learning roadmap based on missing skills
    const weeks = generateRoadmap(missingSkills)

    // Save roadmap to database
    const { data: roadmap, error } = await supabase
      .from('roadmaps')
      .insert({
        user_id: user.id,
        analysis_id: analysisId || null,
        weeks: weeks,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving roadmap:', error)
      return NextResponse.json({ error: 'Failed to save roadmap' }, { status: 500 })
    }

    // Create progress entries for each skill
    const progressEntries = weeks.flatMap((week, weekIndex) =>
      week.skills.map((skill: string) => ({
        user_id: user.id,
        roadmap_id: roadmap.id,
        week_index: weekIndex,
        skill_name: skill,
        completed: false,
      }))
    )

    if (progressEntries.length > 0) {
      const { error: progressError } = await supabase
        .from('progress')
        .insert(progressEntries)

      if (progressError) {
        console.error('Error saving progress entries:', progressError)
      }
    }

    return NextResponse.json({ roadmap, weeks })
  } catch (error) {
    console.error('Roadmap generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateRoadmap(missingSkills: string[]) {
  // Organize skills by estimated learning time/complexity
  const skillCategories = {
    fundamentals: [] as string[],
    intermediate: [] as string[],
    advanced: [] as string[],
  }

  // Categorize skills based on common patterns
  missingSkills.forEach(skill => {
    const lowerSkill = skill.toLowerCase()
    if (
      lowerSkill.includes('basic') ||
      lowerSkill.includes('fundamental') ||
      lowerSkill.includes('introduction') ||
      lowerSkill.includes('html') ||
      lowerSkill.includes('css') ||
      lowerSkill.includes('git')
    ) {
      skillCategories.fundamentals.push(skill)
    } else if (
      lowerSkill.includes('advanced') ||
      lowerSkill.includes('architecture') ||
      lowerSkill.includes('optimization') ||
      lowerSkill.includes('security') ||
      lowerSkill.includes('devops') ||
      lowerSkill.includes('kubernetes') ||
      lowerSkill.includes('machine learning')
    ) {
      skillCategories.advanced.push(skill)
    } else {
      skillCategories.intermediate.push(skill)
    }
  })

  // Build weekly roadmap
  const weeks = []
  const allSkills = [
    ...skillCategories.fundamentals,
    ...skillCategories.intermediate,
    ...skillCategories.advanced,
  ]

  // Distribute skills across weeks (2-3 skills per week)
  const skillsPerWeek = 2
  let weekNumber = 1

  for (let i = 0; i < allSkills.length; i += skillsPerWeek) {
    const weekSkills = allSkills.slice(i, i + skillsPerWeek)
    
    let phase = 'Foundation'
    if (weekNumber > Math.ceil(allSkills.length / skillsPerWeek / 3) * 2) {
      phase = 'Advanced'
    } else if (weekNumber > Math.ceil(allSkills.length / skillsPerWeek / 3)) {
      phase = 'Intermediate'
    }

    weeks.push({
      week: weekNumber,
      title: `Week ${weekNumber}: ${phase} Skills`,
      skills: weekSkills,
      resources: weekSkills.map(skill => ({
        skill,
        links: generateResourceLinks(skill),
      })),
      estimatedHours: weekSkills.length * 5,
    })
    
    weekNumber++
  }

  return weeks
}

function generateResourceLinks(skill: string) {
  const skillLower = skill.toLowerCase()
  const encodedSkill = encodeURIComponent(skill)
  
  const resources = [
    {
      title: `${skill} - Official Documentation`,
      url: `https://www.google.com/search?q=${encodedSkill}+documentation`,
      type: 'documentation',
    },
    {
      title: `Learn ${skill} - Tutorial`,
      url: `https://www.youtube.com/results?search_query=${encodedSkill}+tutorial`,
      type: 'video',
    },
  ]

  // Add specific resources for common technologies
  if (skillLower.includes('react')) {
    resources.push({
      title: 'React Documentation',
      url: 'https://react.dev',
      type: 'documentation',
    })
  }
  if (skillLower.includes('typescript')) {
    resources.push({
      title: 'TypeScript Handbook',
      url: 'https://www.typescriptlang.org/docs/',
      type: 'documentation',
    })
  }
  if (skillLower.includes('python')) {
    resources.push({
      title: 'Python Documentation',
      url: 'https://docs.python.org/3/',
      type: 'documentation',
    })
  }
  if (skillLower.includes('node')) {
    resources.push({
      title: 'Node.js Documentation',
      url: 'https://nodejs.org/docs/',
      type: 'documentation',
    })
  }

  return resources
}

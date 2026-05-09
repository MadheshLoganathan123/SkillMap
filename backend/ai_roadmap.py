import os
import json
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

# OpenRouter uses OpenAI-compatible API
def get_client():
    """Lazy load the OpenAI client to ensure env vars are loaded"""
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY not found in environment variables")
    
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key
    )

def generate_ai_roadmap(missing_skills: list, existing_skills: list, target_role: str, user_experience: str = ""):
    """
    Generate a personalized learning roadmap using OpenRouter AI.
    
    Args:
        missing_skills: List of skills the user needs to learn
        existing_skills: List of skills the user already has
        target_role: The target job role
        user_experience: Years of experience or background info
    
    Returns:
        List of roadmap steps with detailed learning paths
    """
    
    if not missing_skills:
        return []
    
    # Get client
    client = get_client()
    
    # Create a detailed prompt for the AI
    prompt = f"""You are a career development expert. Create a personalized learning roadmap for someone targeting the role: {target_role}.

**Current Skills:** {', '.join(existing_skills) if existing_skills else 'None listed'}
**Skills to Learn:** {', '.join(missing_skills)}
**Experience Level:** {user_experience if user_experience else 'Not specified'}

Create a step-by-step learning roadmap that:
1. Orders skills logically based on dependencies (learn fundamentals first)
2. Groups related skills together
3. Provides realistic time estimates for each skill
4. Includes specific learning objectives for each skill
5. Suggests practical projects to apply each skill

Return ONLY a valid JSON array with this exact structure (no markdown, no extra text):
[
  {{
    "step": 1,
    "skill": "Skill Name",
    "duration_weeks": 2,
    "description": "What you'll learn and why it's important",
    "learning_objectives": ["Objective 1", "Objective 2", "Objective 3"],
    "project_ideas": ["Project 1", "Project 2"],
    "prerequisites": ["Prerequisite skill if any"]
  }}
]

Make it practical, achievable, and tailored to the {target_role} role."""

    try:
        # Call OpenRouter API
        response = client.chat.completions.create(
            model="anthropic/claude-3-haiku:beta",  # Free model
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=2000
        )
        
        # Extract the response
        content = response.choices[0].message.content.strip()
        
        # Remove markdown code blocks if present
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        # Parse JSON
        roadmap = json.loads(content)
        
        print(f"AI generated roadmap with {len(roadmap)} steps")
        return roadmap
        
    except json.JSONDecodeError as e:
        print(f"Failed to parse AI response as JSON: {e}")
        print(f"Response was: {content[:200]}...")
        # Fallback to basic roadmap
        return generate_fallback_roadmap(missing_skills)
    except Exception as e:
        print(f"Error generating AI roadmap: {e}")
        # Fallback to basic roadmap
        return generate_fallback_roadmap(missing_skills)


def generate_fallback_roadmap(missing_skills: list):
    """
    Fallback roadmap generator if AI fails.
    """
    roadmap = []
    for i, skill in enumerate(missing_skills, 1):
        roadmap.append({
            "step": i,
            "skill": skill,
            "duration_weeks": 2,
            "description": f"Learn {skill} to enhance your skillset",
            "learning_objectives": [
                f"Understand core concepts of {skill}",
                f"Build practical projects using {skill}",
                f"Apply {skill} in real-world scenarios"
            ],
            "project_ideas": [
                f"Build a simple project with {skill}",
                f"Contribute to open source using {skill}"
            ],
            "prerequisites": []
        })
    return roadmap


def generate_ai_resources(skill: str):
    """
    Generate learning resources for a specific skill using AI.
    """
    client = get_client()
    
    prompt = f"""Suggest the top 3 learning resources for: {skill}

Return ONLY a valid JSON array (no markdown, no extra text):
[
  {{
    "title": "Resource Name",
    "url": "https://example.com",
    "type": "Course/Documentation/Tutorial/Book",
    "description": "Brief description"
  }}
]"""

    try:
        response = client.chat.completions.create(
            model="google/gemini-2.0-flash-exp:free",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=500
        )
        
        content = response.choices[0].message.content.strip()
        
        # Clean markdown
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        resources = json.loads(content)
        return resources
        
    except Exception as e:
        print(f"Error generating resources for {skill}: {e}")
        # Return default resources
        return [
            {
                "title": f"Learn {skill}",
                "url": f"https://www.google.com/search?q=learn+{skill.replace(' ', '+')}",
                "type": "Search",
                "description": f"Search results for learning {skill}"
            }
        ]

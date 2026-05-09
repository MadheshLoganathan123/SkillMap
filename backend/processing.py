import pdfplumber
import spacy
from spacy.pipeline import EntityRuler
import os
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import networkx as nx

# Load spaCy model
try:
    nlp = spacy.load("en_core_web_md")
except OSError:
    # Fallback if model is not downloaded yet (though our installation script should handle it)
    nlp = spacy.blank("en")

def setup_skill_nlp(nlp_instance):
    """
    Adds a custom EntityRuler to spaCy to identify SKILL and TECHNOLOGY entities.
    In a real-world scenario, this would be replaced by a custom NER model.
    """
    ruler = nlp_instance.add_pipe("entity_ruler", before="ner")
    
    # Sample patterns for demonstration
    patterns = [
        {"label": "SKILL", "pattern": "Python"},
        {"label": "SKILL", "pattern": "FastAPI"},
        {"label": "SKILL", "pattern": "JavaScript"},
        {"label": "SKILL", "pattern": "React"},
        {"label": "SKILL", "pattern": "SQLAlchemy"},
        {"label": "SKILL", "pattern": "PostgreSQL"},
        {"label": "TECHNOLOGY", "pattern": "Supabase"},
        {"label": "TECHNOLOGY", "pattern": "Docker"},
        {"label": "TECHNOLOGY", "pattern": "AWS"},
        {"label": "SKILL", "pattern": [{"LOWER": "machine"}, {"LOWER": "learning"}]},
        {"label": "SKILL", "pattern": [{"LOWER": "data"}, {"LOWER": "analysis"}]},
    ]
    ruler.add_patterns(patterns)
    return nlp_instance

# Initialize NLP with skills
nlp = setup_skill_nlp(nlp)

def extract_text_from_pdf(file_path: str) -> str:
    """
    Extracts text from a PDF file using pdfplumber.
    """
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text.strip()

def identify_skills_and_tech(text: str):
    """
    Identifies entities labeled as SKILL or TECHNOLOGY, and extracts achievements and projects.
    """
    doc = nlp(text)
    skills = []
    technologies = []
    
    for ent in doc.ents:
        if ent.label_ == "SKILL":
            skills.append(ent.text)
        elif ent.label_ == "TECHNOLOGY":
            technologies.append(ent.text)
            
    # Extract structural components
    achievements = extract_achievements(text)
    projects = extract_projects(text)
            
    return {
        "skills": list(set(skills)),
        "technologies": list(set(technologies)),
        "achievements": achievements,
        "projects": projects
    }

def extract_achievements(text: str):
    """
    Heuristic-based extraction of achievements. 
    Looks for bullet points containing action verbs, metrics, or success keywords.
    """
    lines = text.split("\n")
    achievements = []
    
    # Common action verbs and achievement indicators
    indicators = [
        "led", "managed", "increased", "reduced", "saved", "developed", 
        "achieved", "won", "launched", "implemented", "scaled", "automated",
        "%", "$", "score", "performance", "optimization", "award"
    ]
    
    for line in lines:
        line = line.strip()
        # Look for bullet points or lines starting with action verbs
        if line.startswith(("-", "•", "*)")) or any(line.lower().startswith(ind) for ind in indicators):
            if any(ind in line.lower() for ind in indicators) and len(line) > 20:
                achievements.append(line.lstrip("-•* ").strip())
                
    return achievements[:5]  # Return top 5 potential achievements

def extract_projects(text: str):
    """
    Enhanced extraction of projects from resume.
    Extracts project name and full description.
    Returns list of dicts with 'name' and 'description'.
    """
    lines = text.split("\n")
    projects = []
    in_projects_section = False
    current_project = None
    
    print(f"\n=== Starting project extraction ===")
    
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        line_lower = line_stripped.lower()
        
        # Skip empty lines
        if not line_stripped:
            continue
        
        # Check if we're entering the PROJECTS section
        if "project" in line_lower and len(line_stripped) < 50 and line_stripped.isupper():
            in_projects_section = True
            print(f"✓ Found PROJECTS section at line {i}: '{line_stripped}'")
            continue
        
        # Check if we're leaving the PROJECTS section
        if in_projects_section:
            if line_stripped.isupper() and len(line_stripped) > 3:
                if any(keyword in line_lower for keyword in ["experience", "education", "award", "skill", "certification"]):
                    print(f"✗ Leaving PROJECTS section at line {i}: '{line_stripped}'")
                    if current_project:
                        projects.append(current_project)
                    in_projects_section = False
                    break
        
        # Extract project data when in projects section
        if in_projects_section:
            # Project title line (has comma)
            if "," in line_stripped and len(line_stripped) > 10 and line_stripped[0].isupper():
                # Save previous project if exists
                if current_project:
                    projects.append(current_project)
                
                # Start new project
                parts = line_stripped.split(",", 1)
                project_name = parts[0].strip()
                subtitle = parts[1].strip() if len(parts) > 1 else ""
                
                current_project = {
                    "name": project_name,
                    "description": subtitle
                }
                print(f"✓ Extracted project: '{project_name}'")
            
            # Project description continuation (long lines after title)
            elif current_project and len(line_stripped) > 30 and line_stripped[0].isupper():
                # Add to description
                if current_project["description"]:
                    current_project["description"] += " " + line_stripped
                else:
                    current_project["description"] = line_stripped
    
    # Add last project
    if current_project:
        projects.append(current_project)
    
    print(f"=== Extraction complete: {len(projects)} projects found ===\n")
    
    # Return top 5 projects
    return projects[:5]

def calculate_gap_analysis(resume_text: str, jd_text: str, resume_analysis: dict, jd_analysis: dict):
    """
    Calculates match percentage using TF-IDF similarity and identifies missing skills.
    """
    # 1. Match Percentage using TF-IDF
    match_percentage = 0.0
    if resume_text and jd_text:
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform([resume_text, jd_text])
        similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])
        match_percentage = round(float(similarity[0][0]) * 100, 2)

    # 2. Skill Gap Analysis
    resume_skills = set([s.lower() for s in resume_analysis.get("skills", []) + resume_analysis.get("technologies", [])])
    jd_skills_original = jd_analysis.get("skills", []) + jd_analysis.get("technologies", [])
    
    missing_skills = []
    shared_skills = []
    
    for skill in jd_skills_original:
        if skill.lower() in resume_skills:
            shared_skills.append(skill)
        else:
            missing_skills.append(skill)
            
    return {
        "match_percentage": match_percentage,
        "missing_skills": list(set(missing_skills)),
        "shared_skills": list(set(shared_skills))
    }

# Predefined skill requirements for common roles to enable automated roadmaps
ROLE_SKILL_MAP = {
    "Frontend Developer": ["HTML", "CSS", "JavaScript", "React", "Next.js", "TailwindCSS", "TypeScript"],
    "Backend Developer": ["Python", "FastAPI", "SQLAlchemy", "PostgreSQL", "Docker", "AWS", "Git"],
    "Full Stack Developer": ["React", "TypeScript", "Node.js", "PostgreSQL", "Docker", "AWS", "FastAPI"],
    "Data Scientist": ["Python", "Pandas", "Scikit-Learn", "SQL", "Machine Learning", "Data Visualization"],
    "DevOps Engineer": ["Docker", "Kubernetes", "AWS", "Terraform", "Jenkins", "Linux", "Python"],
    "Mobile Developer": ["React Native", "Flutter", "Swift", "Kotlin", "Firebase", "TypeScript"],
}

# Predefined skill dependencies for logical roadmap ordering
SKILL_DEPENDENCIES = {
    # Backend
    "FastAPI": ["Python"],
    "SQLAlchemy": ["Python"],
    "PostgreSQL": ["SQLAlchemy"],
    "Supabase": ["PostgreSQL", "FastAPI"],
    "Django": ["Python"],
    
    # Frontend
    "React": ["JavaScript"],
    "Next.js": ["React"],
    "TailwindCSS": ["CSS"],
    "TypeScript": ["JavaScript"],
    
    # DevOps / Infrastructure
    "Docker": ["Linux"],
    "AWS": ["Docker"],
    "Kubernetes": ["Docker"],
}

def generate_gap_from_role(user_skills: list, target_role: str):
    """
    Automated gap analysis based on a target role instead of a full JD.
    """
    # Find the closest matching role or default to Backend if not found
    role_reqs = ROLE_SKILL_MAP.get(target_role)
    
    if not role_reqs:
        # Simple fuzzy match attempt
        for role, skills in ROLE_SKILL_MAP.items():
            if target_role.lower() in role.lower() or role.lower() in target_role.lower():
                role_reqs = skills
                break
    
    if not role_reqs:
        role_reqs = ROLE_SKILL_MAP["Full Stack Developer"] # Default

    user_skills_norm = set([s.lower() for s in user_skills])
    missing_skills = []
    shared_skills = []

    for skill in role_reqs:
        if skill.lower() in user_skills_norm:
            shared_skills.append(skill)
        else:
            missing_skills.append(skill)

    return {
        "match_percentage": round((len(shared_skills) / len(role_reqs)) * 100, 2) if role_reqs else 0,
        "missing_skills": missing_skills,
        "shared_skills": shared_skills,
        "role_name": target_role
    }

def generate_roadmap(missing_skills: list):
    """
    Generates a step-by-step roadmap for missing skills using a Dependency Graph (DAG).
    Uses NetworkX for topological sorting.
    """
    if not missing_skills:
        return []
        
    G = nx.DiGraph()
    
    # Normalize missing skills for matching
    missing_skills_norm = {s.lower(): s for s in missing_skills}
    
    # Add all missing skills as nodes
    for skill in missing_skills:
        G.add_node(skill)
        
    # Add edges based on dependencies
    # Only add dependency if the required skill is ALSO in the missing list
    for skill in missing_skills:
        skill_clean = skill.strip()
        # Find dependencies for this skill (case-insensitive lookup)
        for dep_target, deps in SKILL_DEPENDENCIES.items():
            if dep_target.lower() == skill_clean.lower():
                for dep in deps:
                    # If the dependency itself is missing, add an edge: dep -> skill
                    if dep.lower() in missing_skills_norm:
                        G.add_edge(missing_skills_norm[dep.lower()], skill)
    
    try:
        # Get topological sort of the graph
        # This gives a valid learning order
        ordered_skills = list(nx.topological_sort(G))
        
        # Build step-by-step roadmap
        roadmap = []
        for i, skill in enumerate(ordered_skills, 1):
            roadmap.append({
                "step": i,
                "skill": skill,
                "description": f"Learn {skill} to bridge the gap in your profile."
            })
        return roadmap
    except nx.NetworkXUnfeasible:
        # In case of cycles (shouldn't happen with our manual map), fallback to simple list
        return [{"step": i+1, "skill": s, "description": f"Learn {s}"} for i, s in enumerate(missing_skills)]

if __name__ == "__main__":
    # Example usage (uncomment to test locally)
    # sample_text = "Experienced in Python and FastAPI. Familiar with React and Supabase."
    # results = identify_skills_and_tech(sample_text)
    # print(results)
    pass

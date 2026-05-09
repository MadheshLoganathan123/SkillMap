from backend.processing import identify_skills_and_tech

def test_enhanced_extraction():
    sample_text = """
    EXPERIENCE
    Senior Software Engineer at Tech Corp
    • Led a team of 5 developers to launch a new e-commerce platform, increasing revenue by 20%.
    • Automated CI/CD pipelines using Docker and Jenkins, reducing deployment time by 50%.
    • Spearheaded the migration to AWS, saving $10k in monthly infrastructure costs.
    
    PROJECTS
    Personal Portfolio: Built a full-stack job board using Next.js and Supabase.
    AI Chatbot: Developed a RAG-based chatbot using Python and OpenAI.
    
    SKILLS
    Python, FastAPI, JavaScript, React, PostgreSQL, Docker, AWS
    """
    
    results = identify_skills_and_tech(sample_text)
    
    with open("nlp_test_log.txt", "w") as f:
        f.write("--- NLP Extraction Results ---\n")
        f.write(f"Skills: {results['skills']}\n")
        f.write(f"Technologies: {results['technologies']}\n")
        f.write("\nAchievements:\n")
        for ach in results['achievements']:
            f.write(f" - {ach}\n")
            
        f.write("\nProjects:\n")
        for proj in results['projects']:
            f.write(f" - {proj}\n")

if __name__ == "__main__":
    test_enhanced_extraction()

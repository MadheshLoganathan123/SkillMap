import os
import sys

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.database import save_roadmap_data

def test_supabase_insertion():
    print("Testing Supabase Insertion...")
    user_id = "00000000-0000-0000-0000-000000000000" # Dummy UUID
    resume_analysis = {"skills": ["Python"], "technologies": ["Docker"]}
    gap_analysis = {"match_percentage": 50.0, "missing_skills": ["FastAPI"]}
    roadmap = [{"step": 1, "skill": "FastAPI", "description": "Learn FastAPI"}]
    
    result = save_roadmap_data(user_id, resume_analysis, gap_analysis, roadmap)
    
    if result:
        print("Successfully connected to Supabase and performed insertion.")
        print(f"Response: {result}")
    else:
        print("Failed to save to Supabase. Check credentials and RLS policies.")

if __name__ == "__main__":
    test_supabase_insertion()

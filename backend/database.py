from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
# Use service role key for backend operations (bypasses RLS)
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    raise ValueError("Supabase credentials not found. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local")

print(f"Connecting to Supabase with {'service role' if 'SERVICE_ROLE' in str(key) else 'anon'} key")
supabase: Client = create_client(url, key)

def ensure_user_exists(user_id: str):
    """
    Ensure a minimal user record exists in the `users` table to satisfy
    foreign key constraints for downstream tables used by the dashboard.
    This is tolerant: if the user already exists it does nothing.
    """
    if not user_id:
        return None
    try:
        ans = supabase.table("users").select("*").eq("id", user_id).maybe_single().execute()
        if not ans or not ans.data:
            # Insert a minimal user record. Add created_at to satisfy common schemas.
            supabase.table("users").insert({"id": user_id, "created_at": "now()"}).execute()
            print(f"Inserted minimal users record for {user_id}")
        return True
    except Exception as e:
        print(f"Failed to ensure user exists for {user_id}: {e}")
        return None

def save_roadmap_data(user_id: str, resume_analysis: dict, gap_analysis: dict, roadmap: list):
    """
    Saves the data to the legacy user_roadmaps table (for backward compatibility).
    """
    if not user_id: return None
    data = {"user_id": user_id, "resume_analysis": resume_analysis, "gap_analysis": gap_analysis, "roadmap": roadmap}
    try:
        return supabase.table("user_roadmaps").insert(data).execute()
    except Exception as e:
        print(f"Error saving to user_roadmaps: {e}")
        return None

def save_advanced_roadmap(user_id: str, resume_analysis: dict, gap_analysis: dict, roadmap: list):
    """
    Saves data across the structured tables (analyses, roadmaps, progress) to activate frontend pages.
    """
    if not user_id: 
        print("No user_id provided")
        return None
    
    if not roadmap or len(roadmap) == 0:
        print("No roadmap data to save")
        return None
    
    try:
        print(f"Saving roadmap for user {user_id}")
        print(f"Roadmap has {len(roadmap)} items")
        print(f"First roadmap item: {roadmap[0]}")
        
        # 1. Save to analyses - use insert instead of upsert
        analysis_data = {
            "user_id": user_id,
            "missing_skills": gap_analysis.get("missing_skills", []),
            "existing_skills": gap_analysis.get("shared_skills", []),
            "match_score": gap_analysis.get("match_percentage", 0),
            "resume_data": resume_analysis
        }
        
        # Delete old analyses for this user first
        supabase.table("analyses").delete().eq("user_id", user_id).execute()
        
        analysis_resp = supabase.table("analyses").insert(analysis_data).execute()
        analysis_id = analysis_resp.data[0]["id"]
        print(f"Saved analysis with id: {analysis_id}")

        # 2. Convert roadmap to weeks format
        # Check if roadmap items have AI-generated structure
        weeks = []
        
        if roadmap and len(roadmap) > 0 and isinstance(roadmap[0], dict) and "skill" in roadmap[0]:
            # AI-generated roadmap with detailed structure
            print("Processing AI-generated roadmap")
            
            # Group by 2 skills per week, but preserve AI details
            skills_per_week = 2
            for i in range(0, len(roadmap), skills_per_week):
                week_items = roadmap[i:i + skills_per_week]
                week_skills = [item["skill"] for item in week_items]
                
                # Combine descriptions and objectives from all skills in this week
                descriptions = [item.get("description", "") for item in week_items if item.get("description")]
                objectives = []
                projects = []
                
                for item in week_items:
                    if item.get("learning_objectives"):
                        objectives.extend(item["learning_objectives"])
                    if item.get("project_ideas"):
                        projects.extend(item["project_ideas"])
                
                weeks.append({
                    "week": (i // skills_per_week) + 1,
                    "skills": week_skills,
                    "resources": [],  # Resources will be added by frontend
                    "description": " | ".join(descriptions) if descriptions else None,
                    "learning_objectives": objectives[:5] if objectives else None,  # Limit to 5
                    "project_ideas": projects[:3] if projects else None,  # Limit to 3
                    "duration_weeks": week_items[0].get("duration_weeks", 2) if week_items else 2
                })
        else:
            # Simple roadmap format
            print("Processing simple roadmap format")
            skills_per_week = 2
            for i in range(0, len(roadmap), skills_per_week):
                week_skills = roadmap[i:i + skills_per_week]
                weeks.append({
                    "week": (i // skills_per_week) + 1,
                    "skills": week_skills,
                    "resources": []
                })

        print(f"Created {len(weeks)} weeks")
        print(f"First week: {weeks[0]}")

        # 3. Save to roadmaps with weeks structure
        # Some deployments may not have the legacy `roadmap` column; only include
        # fields we know are present (user_id, analysis_id, weeks).
        roadmap_data = {
            "user_id": user_id,
            "analysis_id": analysis_id,
            "weeks": weeks,
        }
        
        # Delete old roadmaps for this user to avoid duplicates
        supabase.table("roadmaps").delete().eq("user_id", user_id).execute()
        
        roadmap_resp = supabase.table("roadmaps").insert(roadmap_data).execute()
        roadmap_id = roadmap_resp.data[0]["id"]
        print(f"Saved roadmap with id: {roadmap_id}")

        # 4. Save to progress
        progress_entries = []
        for week_idx, week in enumerate(weeks):
            for skill in week.get("skills", []):
                progress_entries.append({
                    "user_id": user_id,
                    "roadmap_id": roadmap_id,
                    "week_index": week_idx,
                    "skill_name": skill,
                    "completed": False
                })
        
        if progress_entries:
            # Delete old progress entries for this user
            supabase.table("progress").delete().eq("user_id", user_id).execute()
            supabase.table("progress").insert(progress_entries).execute()
            print(f"Saved {len(progress_entries)} progress entries")

        print(f"Successfully saved complete roadmap with {len(weeks)} weeks")
        return {"analysis_id": analysis_id, "roadmap_id": roadmap_id}
    except Exception as e:
        print(f"Error in advanced save: {e}")
        import traceback
        traceback.print_exc()
        return None
        return None

# --- NEW DASHBOARD WORKFLOW FUNCTIONS ---

def upsert_resume(user_id: str, raw_text: str, structured_data: dict):
    if not user_id: return None
    ensure_user_exists(user_id)
    data = {
        "user_id": user_id,
        "raw_text": raw_text,
        "structured_data": structured_data,
        "updated_at": "now()"
    }
    try:
        return supabase.table("resumes").upsert(data, on_conflict="user_id").execute()
    except Exception as e:
        print(f"Warning: failed to upsert resume for {user_id}: {e}")
        return None

def upsert_quiz(user_id: str, answers: dict):
    if not user_id: return None
    ensure_user_exists(user_id)
    data = {
        "user_id": user_id,
        "answers": answers,
        "updated_at": "now()"
    }
    try:
        return supabase.table("quiz_answers").upsert(data, on_conflict="user_id").execute()
    except Exception as e:
        print(f"Warning: failed to upsert quiz for {user_id}: {e}")
        return None

def upsert_profile(user_id: str, profile_data: dict):
    if not user_id: return None
    # Ensure a minimal user exists to satisfy FK constraints
    ensure_user_exists(user_id)
    data = {
        "user_id": user_id,
        **profile_data,
        "updated_at": "now()"
    }
    try:
        return supabase.table("profiles").upsert(data, on_conflict="user_id").execute()
    except Exception as e:
        print(f"Warning: failed to upsert profile for {user_id}: {e}")
        return None

def upsert_skill_gaps(user_id: str, gap_data: dict):
    if not user_id: return None
    ensure_user_exists(user_id)
    data = {
        "user_id": user_id,
        **gap_data,
        "updated_at": "now()"
    }
    try:
        return supabase.table("skill_gaps").upsert(data, on_conflict="user_id").execute()
    except Exception as e:
        print(f"Warning: failed to upsert skill gaps for {user_id}: {e}")
        return None

def fetch_dashboard_data(user_id: str):
    if not user_id: return None
    
    try:
        resume = supabase.table("resumes").select("*").eq("user_id", user_id).maybe_single().execute()
        quiz = supabase.table("quiz_answers").select("*").eq("user_id", user_id).maybe_single().execute()
        profile = supabase.table("profiles").select("*").eq("user_id", user_id).maybe_single().execute()
        gaps = supabase.table("skill_gaps").select("*").eq("user_id", user_id).maybe_single().execute()
        
        # Get all roadmaps for this user
        roadmap = supabase.table("roadmaps").select("*").eq("user_id", user_id).execute()
        
        print(f"Fetching data for user: {user_id}")
        print(f"Resume exists: {bool(resume and resume.data)}")
        print(f"Quiz exists: {bool(quiz and quiz.data)}")
        print(f"Profile exists: {bool(profile and profile.data)}")
        print(f"Gaps exists: {bool(gaps and gaps.data)}")
        print(f"Roadmap count: {len(roadmap.data) if roadmap and roadmap.data else 0}")
        
        # Get the latest roadmap (last one in the list)
        latest_roadmap = None
        if roadmap and roadmap.data and len(roadmap.data) > 0:
            latest_roadmap = roadmap.data[-1]  # Get the last one (most recent)
            print(f"Roadmap keys: {latest_roadmap.keys()}")
            print(f"Roadmap has weeks: {'weeks' in latest_roadmap}")
            print(f"Roadmap has roadmap: {'roadmap' in latest_roadmap}")
            if 'weeks' in latest_roadmap:
                print(f"Number of weeks: {len(latest_roadmap['weeks'])}")
                print(f"First week: {latest_roadmap['weeks'][0] if latest_roadmap['weeks'] else 'None'}")
        
        return {
            "resume": resume.data if resume else None,
            "quiz": quiz.data if quiz else None,
            "profile": profile.data if profile else None,
            "gaps": gaps.data if gaps else None,
            "roadmap": latest_roadmap
        }
    except Exception as e:
        print(f"Error fetching dashboard data: {e}")
        import traceback
        traceback.print_exc()
        return None

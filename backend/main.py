from fastapi import FastAPI, UploadFile, File, Form
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from processing import (
    extract_text_from_pdf, 
    identify_skills_and_tech, 
    generate_roadmap,
    generate_gap_from_role
)
from ai_roadmap import generate_ai_roadmap, generate_ai_resources
from database import (
    save_advanced_roadmap, 
    upsert_resume, 
    upsert_quiz, 
    upsert_profile, 
    upsert_skill_gaps, 
    fetch_dashboard_data
)
import shutil
import json
from fastapi.middleware.cors import CORSMiddleware

from fastapi.responses import JSONResponse
from fastapi import Request

# ── AI Interviewer module ──────────────────────────────────────
from interviewer.routes.interview import router as interview_router
from interviewer.routes.websocket import router as interview_ws_router
from interviewer.exceptions import InterviewerError

app = FastAPI(
    title="SkillMap API",
    description="SkillMap backend – Roadmap generation & AI Interviewer",
    version="2.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Include the AI Interviewer router ──────────────────────────
app.include_router(interview_router)
app.include_router(interview_ws_router)


@app.exception_handler(InterviewerError)
async def interviewer_exception_handler(request: Request, exc: InterviewerError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": exc.message},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": str(exc)},
    )

@app.get("/")
async def root():
    return {
        "message": "SkillMap Backend is running",
        "version": "2.0.0",
        "modules": ["roadmap", "ai-interviewer"],
    }

@app.get("/dashboard/{user_id}")
async def get_dashboard(user_id: str):
    data = fetch_dashboard_data(user_id)
    if not data:
        return {"error": "User data not found"}
    
    # Debug logging
    print(f"Dashboard data for {user_id}:")
    print(f"  Resume: {bool(data.get('resume'))}")
    print(f"  Quiz: {bool(data.get('quiz'))}")
    print(f"  Profile: {bool(data.get('profile'))}")
    print(f"  Gaps: {bool(data.get('gaps'))}")
    print(f"  Roadmap: {bool(data.get('roadmap'))}")
    if data.get('roadmap'):
        print(f"  Roadmap ID: {data['roadmap'].get('id')}")
        print(f"  Roadmap has weeks: {bool(data['roadmap'].get('weeks'))}")
        if data['roadmap'].get('weeks'):
            print(f"  Number of weeks: {len(data['roadmap']['weeks'])}")
            print(f"  First week: {data['roadmap']['weeks'][0]}")
    
    return data

@app.get("/debug/roadmap/{user_id}")
async def debug_roadmap(user_id: str):
    """Debug endpoint to check roadmap data directly"""
    from database import supabase
    
    try:
        # Get all roadmaps for this user
        result = supabase.table("roadmaps").select("*").eq("user_id", user_id).execute()
        
        return {
            "user_id": user_id,
            "roadmap_count": len(result.data) if result.data else 0,
            "roadmaps": result.data
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/progress/{user_id}")
async def get_progress(user_id: str):
    """Get progress data for a user and update readiness percentage"""
    from database import supabase, upsert_profile
    
    try:
        # Get latest roadmap
        roadmap_result = supabase.table("roadmaps").select("*").eq("user_id", user_id).execute()
        
        if not roadmap_result.data or len(roadmap_result.data) == 0:
            return {"error": "No roadmap found", "progress": []}
        
        latest_roadmap = roadmap_result.data[-1]
        
        # Get progress for this roadmap
        progress_result = supabase.table("progress").select("*").eq("roadmap_id", latest_roadmap["id"]).execute()
        
        completed_count = sum(1 for p in progress_result.data if p.get("completed")) if progress_result.data else 0
        total_count = len(progress_result.data) if progress_result.data else 0
        
        # Calculate readiness percentage
        progress_percentage = round((completed_count / total_count * 100) if total_count > 0 else 0, 2)
        
        # Get current profile
        profile_result = supabase.table("profiles").select("*").eq("user_id", user_id).maybe_single().execute()
        
        if profile_result.data:
            # Update readiness based on progress
            # Readiness = initial match score + (progress * (100 - match_score))
            initial_match = profile_result.data.get("match_score", 0)
            readiness = initial_match + (progress_percentage / 100) * (100 - initial_match)
            
            # Update profile with new readiness
            upsert_profile(user_id, {"readiness_percentage": round(readiness, 2)})
            
            print(f"Updated readiness for {user_id}: {readiness:.2f}% (progress: {progress_percentage}%, initial match: {initial_match}%)")
        
        return {
            "roadmap_id": latest_roadmap["id"],
            "progress": progress_result.data or [],
            "stats": {
                "completed": completed_count,
                "total": total_count,
                "percentage": progress_percentage,
                "readiness": round(readiness, 2) if profile_result.data else 0
            }
        }
    except Exception as e:
        print(f"Error fetching progress: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

@app.patch("/progress/{progress_id}")
async def update_progress(progress_id: str, completed: bool = Form(...)):
    """Update progress completion status"""
    from database import supabase
    import datetime
    
    try:
        update_data = {
            "completed": completed,
            "completed_at": datetime.datetime.now().isoformat() if completed else None
        }
        
        result = supabase.table("progress").update(update_data).eq("id", progress_id).execute()
        
        if result.data and len(result.data) > 0:
            return {"success": True, "progress": result.data[0]}
        else:
            return {"success": False, "error": "Progress item not found"}
    except Exception as e:
        print(f"Error updating progress: {e}")
        return {"success": False, "error": str(e)}

@app.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    user_id: str = Form(...)
):
    os.makedirs("temp", exist_ok=True)
    file_path = f"temp/{file.filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        resume_text = extract_text_from_pdf(file_path)
        structured_data = identify_skills_and_tech(resume_text)
        
        # Save to resumes table
        upsert_resume(user_id, resume_text, structured_data)
        
        return {
            "success": True,
            "structured_data": structured_data
        }
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

@app.post("/process-resume")
async def process_resume(
    file: UploadFile = File(...),
    job_description: str = Form(...)
):
    os.makedirs("temp", exist_ok=True)
    file_path = f"temp/{file.filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # Extract and analyze resume
        resume_text = extract_text_from_pdf(file_path)
        resume_analysis = identify_skills_and_tech(resume_text)
        
        # Analyze job description
        jd_analysis = identify_skills_and_tech(job_description)
        
        # Calculate gap analysis
        from processing import calculate_gap_analysis
        gap_analysis = calculate_gap_analysis(
            resume_text, 
            job_description, 
            resume_analysis, 
            jd_analysis
        )
        
        return {
            "success": True,
            "resume_analysis": resume_analysis,
            "jd_analysis": jd_analysis,
            "gap_analysis": gap_analysis
        }
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

@app.post("/save-quiz")
async def save_quiz(
    user_id: str = Form(...),
    answers: str = Form(...) # JSON string
):
    try:
        answers_dict = json.loads(answers)
        upsert_quiz(user_id, answers_dict)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/generate-career-profile")
async def generate_career_profile(
    user_id: str = Form(...),
    target_role: str = Form(...),
    skills: str = Form(...) # JSON string of user skills
):
    try:
        print(f"\n=== Starting career profile generation for user {user_id} ===")
        user_skills = json.loads(skills)
        print(f"User skills: {user_skills}")
        
        # 1. Generate Gap Analysis from Role
        print(f"Generating gap analysis for role: {target_role}")
        gap_analysis = generate_gap_from_role(user_skills, target_role)
        print(f"Gap analysis complete. Missing skills: {gap_analysis['missing_skills']}")
        
        # 2. Update Profile & Skill Gaps
        profile_data = {
            "target_role": target_role,
            "match_score": gap_analysis["match_percentage"],
            "readiness_percentage": gap_analysis["match_percentage"]
        }
        print(f"Saving profile data...")
        try:
            upsert_profile(user_id, profile_data)
        except Exception as e:
            print(f"Warning: upsert_profile failed: {e}")

        gap_data = {
            "missing_skills": gap_analysis["missing_skills"],
            "existing_skills": gap_analysis["shared_skills"]
        }
        print(f"Saving skill gaps...")
        try:
            upsert_skill_gaps(user_id, gap_data)
        except Exception as e:
            print(f"Warning: upsert_skill_gaps failed: {e}")
        
        # 3. Generate AI-powered roadmap
        print(f"\n=== Generating AI roadmap ===")
        print(f"Missing skills count: {len(gap_analysis['missing_skills'])}")
        print(f"Missing skills: {gap_analysis['missing_skills']}")
        
        roadmap = None
        try:
            print("Calling AI roadmap generator...")
            roadmap = generate_ai_roadmap(
                missing_skills=gap_analysis["missing_skills"],
                existing_skills=gap_analysis["shared_skills"],
                target_role=target_role,
                user_experience=""
            )
            print(f"✓ AI roadmap generated with {len(roadmap)} steps")
            print(f"First roadmap item: {roadmap[0] if roadmap else 'None'}")
        except Exception as e:
            print(f"✗ AI generation failed: {e}")
            import traceback
            traceback.print_exc()
            print("Using fallback roadmap generator...")
            roadmap = generate_roadmap(gap_analysis["missing_skills"])
            print(f"✓ Fallback roadmap generated with {len(roadmap)} steps")
        
        if not roadmap or len(roadmap) == 0:
            print("✗ ERROR: No roadmap generated!")
            return {
                "success": False,
                "error": "Failed to generate roadmap",
                "profile": profile_data,
                "gaps": gap_data,
                "roadmap": []
            }
        
        # 4. Save roadmap to database
        print(f"\n=== Saving roadmap to database ===")
        save_result = save_advanced_roadmap(user_id, {"skills": user_skills}, gap_analysis, roadmap)
        
        if save_result:
            print(f"✓ Roadmap saved successfully: {save_result}")
        else:
            print("✗ ERROR: Failed to save roadmap to database!")
            return {
                "success": False,
                "error": "Roadmap generated but failed to save. Check Supabase credentials/RLS/table schema.",
                "profile": profile_data,
                "gaps": gap_data,
                "roadmap": roadmap
            }
        
        print(f"\n=== Career profile generation complete ===\n")
        
        return {
            "success": True,
            "profile": profile_data,
            "gaps": gap_data,
            "roadmap": roadmap
        }
    except Exception as e:
        print(f"\n✗ ERROR in generate_career_profile: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    # Use PORT env var if provided to avoid conflicts; default to 8001
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)

from backend.database import supabase

def verify_db_records():
    # Use the test user_id I used in curl
    user_id = "00000000-0000-0000-0000-000000000000"
    
    print(f"Checking records for user: {user_id}")
    
    # 1. Check analyses
    ans = supabase.table("analyses").select("*").eq("user_id", user_id).execute()
    print(f"Analyses: {len(ans.data)} records found")
    
    # 2. Check roadmaps
    rds = supabase.table("roadmaps").select("*").eq("user_id", user_id).execute()
    print(f"Roadmaps: {len(rds.data)} records found")
    
    # 3. Check progress
    pgs = supabase.table("progress").select("*").eq("user_id", user_id).execute()
    print(f"Progress entries: {len(pgs.data)} records found")

if __name__ == "__main__":
    verify_db_records()

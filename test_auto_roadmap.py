import requests
import json

def test_auto_roadmap():
    url = "http://localhost:8001/auto-roadmap"
    data = {
        "user_id": "00000000-0000-0000-0000-000000000000",
        "target_role": "Backend Developer",
        "resume_analysis": json.dumps({"skills": ["Python", "Git"]})
    }
    
    print(f"Testing {url} with role: {data['target_role']}...")
    try:
        # Added timeout to avoid hanging
        response = requests.post(url, data=data, timeout=15)
        response.raise_for_status()
        result = response.json()
        
        # Write results to a file for reliable verification
        with open("auto_roadmap_test.log", "w") as f:
            if result.get("success"):
                f.write("Successfully generated auto-roadmap!\n")
                f.write(f"Match Percentage: {result['gap_analysis']['match_percentage']}%\n")
                f.write(f"Missing Skills: {result['gap_analysis']['missing_skills']}\n")
                f.write(f"Roadmap Steps: {len(result['roadmap'])}\n")
                print("Test passed! Check auto_roadmap_test.log")
            else:
                f.write(f"Failed: {result.get('error')}\n")
                print("Test failed. Check auto_roadmap_test.log")
    except Exception as e:
        with open("auto_roadmap_test.log", "w") as f:
            f.write(f"Error: {e}\n")
        print(f"Test error: {e}")

if __name__ == "__main__":
    test_auto_roadmap()

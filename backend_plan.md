# SkillMap Backend Implementation Plan (Revised)

## Core Responsibility
The FastAPI backend focuses on processing resumes and generating skill roadmaps:
- **AI/NLP Processing Engine**
- **Data Analysis & Gap Identification**
- **Roadmap Generation**
- **Supabase Data Persistence**

## ⚙️ Backend Flow (Dashboard-Centric)
1. **Dashboard Input**: User uploads Resume (PDF) + Job Description (Text/URL/PDF).
2. **FastAPI Processing**:
    - **Extraction**: `pdfplumber` parses the resume.
    - **Skill Identification**: `spaCy` NER extracts skills from both resume and JD.
    - **Gap Analysis**: `scikit-learn` (TF-IDF) identifies missing skills and calculates match scores.
    - **Pathfinding**: `networkx` builds a dependency graph of missing skills.
3. **Roadmap Output**: `Topological Sort` orders skills into a logical learning roadmap.
4. **Persistence**: Results are stored in **Supabase (PostgreSQL)** linked to the user's Supabase ID.
5. **JSON Response**: Returns the complete roadmap and analysis to the Dashboard.

## 🧩 Key FastAPI Modules

### 🔹 1. Resume & JD Processing Module
- **Action**: Extract clean text from PDF uploads.
- **Action**: Identify entities labeled as "SKILL" or "TECHNOLOGY".
- **Libraries**: `pdfplumber`, `spaCy` (en_core_web_md).

### 🔹 2. Gap Analysis Engine
- **Action**: Compare extracted resume skills against JD requirements.
- **Action**: Generate a list of "Missing Skills" and a "Match Percentage".
- **Library**: `scikit-learn` (TF-IDF similarity).

### 🔹 3. Roadmap Generator
- **Action**: Use a predefined skill dependency map (or dynamic derivation) to order skills.
- **Action**: Generate a step-by-step roadmap for the user.
- **Library**: `networkx`.

### 🔹 4. Database Layer (Supabase)
- **Action**: Store parsed resumes, identified gaps, and generated roadmaps.
- **Action**: Sync with existing Supabase Auth metadata.
- **Library**: `SQLAlchemy` (for PostgreSQL access) or `supabase-py`.

## 📦 Backend Dependencies
```bash
# Core
pip install fastapi uvicorn pydantic python-dotenv

# File & NLP
pip install python-multipart pdfplumber spacy
python -m spacy download en_core_web_md

# ML & Logic
pip install scikit-learn networkx

# Database
pip install sqlalchemy psycopg2-binary asyncpg supabase
```

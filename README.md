# Legal AI Contract Compliance Auditor

Legal AI Contract Compliance Auditor is a web-based platform that performs clause-by-clause legal contract analysis using state-of-the-art AI models. It identifies compliance gaps, classifies clauses into legal categories, and provides intelligent recommendations to improve contractual soundness.

## Features

- Clause classification using a fine-tuned LegalBERT model
- Compliance risk assessment and scoring
- AI-generated suggestions for non-compliant or ambiguous clauses
- Upload support for PDF, DOCX, and TXT formats
- User-friendly frontend interface for legal professionals

## Tech Stack

**Backend:**

- Python
- Flask
- Hugging Face Transformers (LegalBERT, FLAN-T5)
- PyTorch

**Frontend:**

- React
- TypeScript
- Tailwind CSS
- Vite

## Backend Setup

### Step 1: Navigate to backend folder

cd backend

### Step 2: Create and activate virtual environment

python -m venv venv
venv\Scripts\activate # For Windows

#### or

source venv/bin/activate # For macOS/Linux

### Step 3: Install dependencies

pip install -r requirements.txt

### Step 4: Run the Flask app

python app.py

Frontend Setup
bash
Copy
Edit

### Step 1: Navigate to frontend folder

cd legal-ai-contract-guardian-main

### Step 2: Install dependencies

npm install

### Step 3: Start development server

npm run dev

## Input

The application supports uploading legal contracts in the following formats:

.pdf

.docx

.txt

Each uploaded contract is automatically parsed, and individual clauses are extracted for analysis.

## Output

For each clause, the application displays:

Identified clause category (multi-label classification)

Compliance status: Compliant, Non-Compliant, or Needs Review

Risk level: Low, Medium, or High

AI-generated improvement suggestions

Overall contract compliance score

The frontend presents a structured view for clause-wise analysis, along with a summary dashboard.

## Future Enhancements

Integration with live legal databases for regulatory cross-checking

Multi-jurisdictional legal clause support

Secure versioned storage of compliance reports

Clause similarity detection and benchmarking against best practices

Audit trails with blockchain integration

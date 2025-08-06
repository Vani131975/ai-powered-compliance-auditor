import os
import torch
import pdfplumber
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from transformers import AutoTokenizer, AutoModelForSequenceClassification, AutoModelForSeq2SeqLM
import spacy
import logging
from clause_labels import clause_names  # Your 42-class label list

# -----------------------
# CONFIG & SETUP
# -----------------------
UPLOAD_FOLDER = 'Uploads'
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'txt'}
MODEL_DIR = './legalbert_multi_model'

app = Flask(__name__)
CORS(app)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Logging
logging.basicConfig(filename='analysis.log', level=logging.INFO)

# Device
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# Load spaCy
nlp = spacy.load("en_core_web_sm")

# -----------------------
# LOAD MODELS
# -----------------------
# Load LegalBERT multi-label classifier
tokenizer_classify = AutoTokenizer.from_pretrained(MODEL_DIR)
model_classify = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR).to(device)

# Load Flan-T5 recommendation model
tokenizer_recommend = AutoTokenizer.from_pretrained("google/flan-t5-base")
model_recommend = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-base").to(device)

# -----------------------
# HELPERS
# -----------------------
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text(file_path):
    if file_path.endswith('.pdf'):
        with pdfplumber.open(file_path) as pdf:
            return ''.join([page.extract_text() or '' for page in pdf.pages])
    else:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()

def split_into_clauses(text):
    doc = nlp(text)
    clauses, buffer = [], []
    for sent in doc.sents:
        buffer.append(sent.text)
        if len(' '.join(buffer)) > 40:
            clauses.append(' '.join(buffer))
            buffer = []
    if buffer:
        clauses.append(' '.join(buffer))
    return [c.strip() for c in clauses if len(c.strip()) > 40]

def generate_local_recommendation(prompts):
    inputs = tokenizer_recommend(prompts, return_tensors="pt", truncation=True, padding=True).to(device)
    outputs = model_recommend.generate(**inputs, max_new_tokens=120)
    return [tokenizer_recommend.decode(o, skip_special_tokens=True) for o in outputs]

def generate_clause_prompts(clauses, contract_type="general contract"):
    return [
        f"Review the following clause from a {contract_type}. Suggest improvements:\n{clause}"
        for clause in clauses
    ]

def analyze_clauses(text, contract_type="general contract"):
    clauses_text = split_into_clauses(text)
    inputs = tokenizer_classify(clauses_text, return_tensors="pt", padding=True, truncation=True, max_length=256).to(device)
    outputs = model_classify(**inputs)
    predictions = torch.sigmoid(outputs.logits).detach().cpu().tolist()

    prompts = generate_clause_prompts(clauses_text, contract_type)
    recommendations = generate_local_recommendation(prompts)

    result_clauses = []
    clause_weights = {
        "Indemnification": 2.0, "Termination": 1.5, "Confidentiality": 1.2,
        "Payment Terms": 1.0, "Liability": 1.0, "Uncategorized": 0.5
    }

    for i, (text_clause, pred_probs) in enumerate(zip(clauses_text, predictions)):
        labels = [clause_names[j] for j, p in enumerate(pred_probs) if p > 0.5]
        avg_conf = sum(pred_probs) / len(pred_probs)
        score = max(pred_probs)

        status = "compliant" if avg_conf > 0.75 else "review_needed" if avg_conf > 0.5 else "non_compliant"
        risk = "low" if score > 0.75 else "medium" if score > 0.5 else "high"

        result_clauses.append({
            "id": i + 1,
            "type": labels or ["Uncategorized"],
            "text": text_clause,
            "complianceStatus": status,
            "riskLevel": risk,
            "recommendation": recommendations[i] if i < len(recommendations) else ""
        })

    compliance_score = sum(
        max(pred) * clause_weights.get(c["type"][0], 1.0)
        for c, pred in zip(result_clauses, predictions)
    ) / sum(clause_weights.get(c["type"][0], 1.0) for c in result_clauses)
    compliance_score = int(compliance_score * 100)

    overall = generate_local_recommendation([
        f"Analyze this {contract_type} excerpt and provide key legal suggestions:\n{text[:2000]}"
    ])[0]

    return {
        "fileName": None,
        "fileSize": None,
        "uploadedAt": datetime.utcnow().isoformat() + "Z",
        "extractedText": text,
        "clauses": result_clauses,
        "complianceScore": compliance_score,
        "totalClauses": len(result_clauses),
        "compliantClauses": sum(c["complianceStatus"] == "compliant" for c in result_clauses),
        "riskyClauses": sum(c["complianceStatus"] != "compliant" for c in result_clauses),
        "recommendations": overall
    }

# -----------------------
# API ROUTES
# -----------------------
@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)

        contract_type = request.form.get('contract_type', 'general contract')
        text = extract_text(file_path)
        analysis = analyze_clauses(text, contract_type)
        analysis["fileName"] = filename
        analysis["fileSize"] = os.path.getsize(file_path)

        return jsonify(analysis), 200

    return jsonify({'error': 'File type not allowed'}), 400

@app.route('/feedback', methods=['POST'])
def submit_feedback():
    data = request.get_json()
    with open('feedback_log.txt', 'a') as f:
        f.write(f"{data}\n")
    return jsonify({'status': 'Feedback recorded'}), 200

# -----------------------
# RUN SERVER
# -----------------------
if __name__ == '__main__':
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(debug=True, host='0.0.0.0', port=5000)

import os
import torch
import pdfplumber
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import spacy
import logging
import requests
from clause_labels import clause_names
from dotenv import load_dotenv
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from io import BytesIO

# -----------------------
# CONFIG & SETUP
# -----------------------
load_dotenv()
UPLOAD_FOLDER = 'Uploads'
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'txt'}
MODEL_DIR = './legalbert_multi_model'
app = Flask(__name__)
CORS(app)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['UPLOAD_FOLDER_URL'] = '/uploads'
app.static_folder = UPLOAD_FOLDER

# Base URL for the backend (adjust for production)
BASE_URL = os.getenv('BASE_URL', 'http://localhost:5000')

logging.basicConfig(filename='analysis.log', level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

nlp = spacy.load("en_core_web_sm")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logging.error("Gemini API key not found in environment variables")
    raise ValueError("Please set GEMINI_API_KEY in your environment variables")

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

# -----------------------
# LOAD MODELS
# -----------------------
try:
    tokenizer_classify = AutoTokenizer.from_pretrained(MODEL_DIR)
    model_classify = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR).to(device)
except Exception as e:
    logging.error(f"Failed to load classification model: {e}")
    raise

# -----------------------
# HELPERS
# -----------------------
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text(file_path):
    try:
        if file_path.endswith('.pdf'):
            with pdfplumber.open(file_path) as pdf:
                text = ''.join([page.extract_text() or '' for page in pdf.pages])
        else:
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
        logging.info(f"Extracted text from {file_path}: {text[:200]}...")
        return text
    except Exception as e:
        logging.error(f"Error extracting text from {file_path}: {e}")
        return ""

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

def extract_parties(text):
    try:
        doc = nlp(text)
        parties, seen_entities = [], set()
        for ent in doc.ents:
            if ent.label_ in ['PERSON', 'ORG'] and ent.text not in seen_entities:
                parties.append({
                    "name": ent.text,
                    "type": ent.label_.lower(),
                    "context": ent.sent.text.strip() if ent.sent else text[:50]
                })
                seen_entities.add(ent.text)
        logging.info(f"Extracted parties: {parties}")
        return parties
    except Exception as e:
        logging.error(f"Error in extract_parties: {e}")
        return []

def generate_local_recommendation(prompts):
    recommendations = []
    headers = {"Content-Type": "application/json"}
    for prompt in prompts:
        try:
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "maxOutputTokens": 256,
                    "temperature": 0.7,
                    "topP": 0.9
                }
            }
            response = requests.post(f"{GEMINI_API_URL}?key={GEMINI_API_KEY}", json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            logging.info(f"Gemini raw response: {result}")

            candidates = result.get("candidates", [])
            if candidates and "content" in candidates[0] and "parts" in candidates[0]["content"]:
                parts = candidates[0]["content"]["parts"]
                if parts and "text" in parts[0]:
                    recommendation = parts[0]["text"].strip()
                else:
                    recommendation = ""
            else:
                recommendation = ""

            recommendation = recommendation.replace("**", "").replace("#", "").strip()
            recommendations.append(recommendation if recommendation else "No recommendation generated")
        except Exception as e:
            logging.error(f"Error generating recommendations with Gemini: {e}")
            recommendations.append("Error generating recommendation")
    return recommendations

def generate_clause_prompts(clauses, contract_type="general contract"):
    return [
        f"You are a legal expert specializing in contract analysis for India, EU (GDPR), and US (CCPA) jurisdictions. "
        f"Review this clause from a {contract_type}: '{clause}'. "
        f"Analyze for compliance, legal risks, and provide a concise, professional recommendation (1-2 sentences, max 50 words). "
        f"Do not use markdown, headings, or say 'No recommendation'."
        for clause in clauses
    ]

def generate_overall_summary(clauses):
    total_clauses = len(clauses)
    risky_clauses = sum(1 for c in clauses if c["complianceStatus"] != "compliant")
    risk_areas = list({c["type"] for c in clauses if c["riskLevel"] != "low"})
    summary_text = (
        f"Identified {total_clauses} clauses, {risky_clauses} require review. "
        f"Key risks: {', '.join(risk_areas[:3]) if risk_areas else 'General compliance issues'}."
    )
    return summary_text

def analyze_clauses(text, contract_type="general contract"):
    try:
        text = text.strip().replace('\n', ' ').replace('\t', ' ')
        parties = extract_parties(text)
        clauses_text = split_into_clauses(text)
        if not clauses_text:
            clauses_text = [text]

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
            avg_conf = sum(pred_probs) / len(pred_probs) if pred_probs else 0.0
            score = max(pred_probs) if pred_probs else 0.0
            status = "compliant" if avg_conf > 0.75 else "review_needed" if avg_conf > 0.5 else "non_compliant"
            risk = "low" if score > 0.75 else "medium" if score > 0.5 else "high"
            result_clauses.append({
                "id": i + 1,
                "type": labels[0] if labels else "Uncategorized",
                "text": text_clause,
                "complianceStatus": status,
                "riskLevel": risk,
                "recommendation": recommendations[i] if i < len(recommendations) else "No recommendation"
            })

        compliance_score = sum(
            max(pred) * clause_weights.get(c["type"], 1.0)
            for c, pred in zip(result_clauses, predictions)
        ) / sum(clause_weights.get(c["type"], 1.0) for c in result_clauses) if result_clauses else 0
        compliance_score = int(compliance_score * 100)

        overall_summary_prompt = (
            f"You are a legal expert specializing in India, EU (GDPR), and US (CCPA). "
            f"Provide a short 2 lines recommendation based on {generate_overall_summary(result_clauses)} overall clauses in one recommendation donot put same clause level recommendations in overall recommendation as it is combina and form a 2 line recommendation out of it "
            f"Use formal language, avoid markdown."
        )
        overall = generate_local_recommendation([overall_summary_prompt])[0]

        if not overall or len(overall.strip()) < 10 or "No recommendation" in overall:
            overall = generate_overall_summary(result_clauses)

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
            "recommendations": overall,
            "parties": parties if parties else []
        }
    except Exception as e:
        logging.error(f"Error in analyze_clauses: {e}")
        return {
            "fileName": None,
            "fileSize": None,
            "uploadedAt": datetime.utcnow().isoformat() + "Z",
            "extractedText": text,
            "clauses": [],
            "complianceScore": 0,
            "totalClauses": 0,
            "compliantClauses": 0,
            "riskyClauses": 0,
            "recommendations": "Error during analysis",
            "parties": []
        }

def generate_pdf_report(analysis):
    try:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        normal_style = styles['Normal']
        heading_style = styles['Heading1']
        subheading_style = styles['Heading2']
        elements = []

        elements.append(Paragraph("Contract Analysis Report", heading_style))
        elements.append(Spacer(1, 12))
        elements.append(Paragraph(f"File: {analysis['fileName']}", normal_style))
        elements.append(Paragraph(f"Size: {(analysis['fileSize'] / 1024):.1f} KB", normal_style))
        elements.append(Paragraph(f"Analyzed on: {datetime.fromisoformat(analysis['uploadedAt'].replace('Z', '+00:00')).strftime('%Y-%m-%d')}", normal_style))
        elements.append(Spacer(1, 12))
        elements.append(Paragraph("Executive Summary", subheading_style))
        elements.append(Paragraph(f"Compliance Score: {analysis['complianceScore']}%", normal_style))
        elements.append(Paragraph(f"Total Clauses: {analysis['totalClauses']}", normal_style))
        elements.append(Paragraph(f"Compliant Clauses: {analysis['compliantClauses']}", normal_style))
        elements.append(Paragraph(f"Clauses Needing Review: {analysis['riskyClauses']}", normal_style))
        elements.append(Spacer(1, 12))
        elements.append(Paragraph("Parties Involved", subheading_style))
        if analysis['parties']:
            for party in analysis['parties']:
                elements.append(Paragraph(f"{party['name']} ({party['type'].capitalize()}): {party['context']}", normal_style))
        else:
            elements.append(Paragraph("No parties identified.", normal_style))
        elements.append(Spacer(1, 12))
        elements.append(Paragraph("Recommendations", subheading_style))
        elements.append(Paragraph(analysis['recommendations'], normal_style))
        elements.append(Spacer(1, 12))
        elements.append(Paragraph("Clause Analysis", subheading_style))
        for clause in analysis['clauses']:
            elements.append(Paragraph(f"Clause {clause['id']}: {clause['type']}", normal_style))
            elements.append(Paragraph(f"Status: {clause['complianceStatus'].replace('_', ' ').title()}", normal_style))
            elements.append(Paragraph(f"Risk Level: {clause['riskLevel'].title()}", normal_style))
            elements.append(Paragraph(f"Text: {clause['text']}", normal_style))
            elements.append(Paragraph(f"Recommendation: {clause['recommendation']}", normal_style))
            elements.append(Spacer(1, 6))

        doc.build(elements)
        buffer.seek(0)
        return buffer
    except Exception as e:
        logging.error(f"Error generating PDF report: {e}")
        raise

# -----------------------
# API ROUTES
# -----------------------
@app.route('/upload', methods=['POST'])
def upload_file():
    try:
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
            analysis["originalFileUrl"] = f"{BASE_URL}{app.config['UPLOAD_FOLDER_URL']}/{filename}"
            logging.info(f"Generated analysis with originalFileUrl: {analysis['originalFileUrl']}")

            return jsonify(analysis), 200
    except Exception as e:
        logging.error(f"Error in upload_file: {e}")
        return jsonify({'error': str(e)}), 500
    return jsonify({'error': 'File type not allowed'}), 400

@app.route('/export-report', methods=['POST'])
def export_report():
    try:
        analysis = request.get_json()
        logging.info(f"Received export-report request with analysis: {analysis.get('fileName')}")
        if not analysis or 'fileName' not in analysis:
            return jsonify({'error': 'Invalid analysis data'}), 400

        pdf_buffer = generate_pdf_report(analysis)
        return send_file(
            pdf_buffer,
            as_attachment=True,
            download_name=f"{analysis['fileName']}_analysis_report.pdf",
            mimetype='application/pdf'
        )
    except Exception as e:
        logging.error(f"Error in export_report: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/feedback', methods=['POST'])
def submit_feedback():
    try:
        data = request.get_json()
        with open('feedback_log.txt', 'a') as f:
            f.write(f"{datetime.now().isoformat()} - {data}\n")
        return jsonify({'status': 'Feedback recorded'}), 200
    except Exception as e:
        logging.error(f"Error in submit_feedback: {e}")
        return jsonify({'error': str(e)}), 500

# -----------------------
# RUN SERVER
# -----------------------
if __name__ == '__main__':
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(debug=True, host='0.0.0.0', port=5000)
import spacy

nlp = spacy.load("en_core_web_sm")
text = """
SERVICE AGREEMENT
This Agreement is entered into on 05 August 2025 between Alpha Tech Pvt. Ltd. ("Service Provider") and Beta Solutions Inc. ("Client").
1. Services: The Service Provider agrees to deliver website maintenance services on a monthly basis.
2. Payment: The Client agrees to pay $59,000 per month within 15 days of invoice receipt.
3. Confidentiality: Both parties shall maintain strict confidentiality of all proprietary information.
4. Termination: Either party may terminate this Agreement with 30 days' written notice.
5. Governing Law: This Agreement shall be governed by the laws of India.
"""

doc = nlp(text)
parties = []
seen_entities = set()
for ent in doc.ents:
    if ent.label_ in ['PERSON', 'ORG'] and ent.text not in seen_entities:
        parties.append({
            "name": ent.text,
            "type": ent.label_.lower(),
            "context": ent.sent.text.strip()
        })
        seen_entities.add(ent.text)

print("Extracted parties:", parties)
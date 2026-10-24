"""Backend privado de Gemini para Rumbo. Requiere Firebase Authentication."""
import os
import requests
import firebase_admin
from firebase_admin import auth
from flask import Flask, request, jsonify

app = Flask(__name__)
firebase_admin.initialize_app()
MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
API_KEY = os.getenv("GEMINI_API_KEY")
ALLOWED_UID = os.getenv("ALLOWED_FIREBASE_UID")

@app.get("/health")
def health():
    return jsonify(status="ok")

@app.post("/chat")
def chat():
    if not API_KEY or not ALLOWED_UID:
        return jsonify(error="Configuración incompleta"), 503
    bearer = request.headers.get("Authorization", "")
    if not bearer.startswith("Bearer "):
        return jsonify(error="Autenticación necesaria"), 401
    try:
        user = auth.verify_id_token(bearer[7:])
        if user.get("uid") != ALLOWED_UID:
            return jsonify(error="Acceso denegado"), 403
    except Exception:
        return jsonify(error="Token no válido"), 401
    data = request.get_json(silent=True) or {}
    message = data.get("message", "")
    if not isinstance(message, str) or not 1 <= len(message) <= 4000:
        return jsonify(error="Mensaje no válido (1-4000 caracteres)"), 400
    prompt = ("Eres un asistente de autoobservación para Rumbo. Habla en español, "
              "sin diagnosticar ni presentar puntuaciones como medidas clínicas. "
              "Ayuda a identificar situaciones, emociones, conductas y estrategias concretas. "
              "No solicites datos identificativos. Si existe riesgo de autolesión, "
              "aconseja ayuda inmediata y servicios de emergencia. "
              "Responde brevemente y propone como máximo una pregunta.")
    payload = {"systemInstruction": {"parts": [{"text": prompt}]},
               "contents": [{"role": "user", "parts": [{"text": message}]}],
               "generationConfig": {"temperature": 0.4, "maxOutputTokens": 700}}
    try:
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
            headers={"x-goog-api-key": API_KEY},
            json=payload, timeout=35)
        response.raise_for_status()
        answer = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        return jsonify(reply=answer)
    except (requests.RequestException, KeyError, IndexError, TypeError):
        return jsonify(error="No se pudo obtener respuesta del modelo"), 502

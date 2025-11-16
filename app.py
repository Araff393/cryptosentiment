from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import requests
import os
import time
from dotenv import load_dotenv
from datetime import datetime
import pytz

load_dotenv()

app = Flask(__name__)
CORS(app)

COINGECKO_API = "https://api.coingecko.com/api/v3"
API_KEY = os.getenv("COINGECKO_API_KEY")

# API KEYS
NEWS_API_KEY = "pub_3328a069208c40ed812c2b98d357680b"
HF_TOKEN = os.getenv("HF_TOKEN")   # HuggingFace Token

print(">>> Loaded CoinGecko API KEY:", API_KEY)
print(">>> HuggingFace Key Loaded:", bool(HF_TOKEN))

# ============================================================
# CACHE
# ============================================================

CACHE = {
    "prices": {"time": 0, "data": None},
    "chart": {},
    "news": {"time": 0, "data": None}
}

CACHE_TTL = 40  # seconds

# ============================================================
# COINGECKO WRAPPER
# ============================================================

def coingecko_get(endpoint, params=None):
    headers = {"x-cg-demo-api-key": API_KEY}

    try:
        response = requests.get(
            f"{COINGECKO_API}/{endpoint}",
            headers=headers,
            params=params,
            timeout=10
        )
        response.raise_for_status()
        return {"status": "success", "data": response.json()}
    except Exception as e:
        return {"status": "error", "data": None, "message": str(e)}

# ============================================================
# FINBERT ANALYSIS
# ============================================================

from huggingface_hub import InferenceClient

hf_client = InferenceClient(
    provider="hf-inference",
    api_key=HF_TOKEN
)

def finbert_sentiment(text):
    """Model FinBERT yang real dan aktif di HuggingFace"""
    if not HF_TOKEN:
        return "neutral", 0.0

    try:
        result = hf_client.text_classification(
            text,
            model="mrm8488/distilroberta-finetuned-financial-news-sentiment-analysis"
        )

        if isinstance(result, list) and len(result) > 0:
            best = max(result, key=lambda x: x["score"])
            label = best.get("label", "neutral").lower()
            confidence = round(best.get("score", 0.0), 3)
            return label, confidence

        return "neutral", 0.0
    except:
        return "neutral", 0.0


# ============================================================
# ROUTES
# ============================================================

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/analisis")
def analisis():
    return render_template("analisis.html")

@app.route("/tentang")
def tentang():
    return render_template("tentang.html")


# ============================================================
# PRICES API
# ============================================================

@app.route("/api/prices")
def get_prices():
    now = time.time()

    if now - CACHE["prices"]["time"] < CACHE_TTL:
        return jsonify({"status": "success", "data": CACHE["prices"]["data"]})

    coin_list = [
        "bitcoin","ethereum","tether","solana","ripple",
        "binancecoin","dogecoin","tron","hyperliquid","cardano"
    ]

    params = {"vs_currency": "usd", "ids": ",".join(coin_list)}

    try:
        r = requests.get(
            f"{COINGECKO_API}/coins/markets",
            params=params,
            headers={"x-cg-demo-api-key": API_KEY},
            timeout=10
        )
        r.raise_for_status()
        data = r.json()

        CACHE["prices"]["data"] = data
        CACHE["prices"]["time"] = now

        return jsonify({"status": "success", "data": data})
    except Exception as e:
        return jsonify({"status": "error", "data": [], "message": str(e)})


# ============================================================
# CHART API
# ============================================================

@app.route("/api/chart/<coin>")
def get_chart(coin):
    days = request.args.get("days", "1")
    cache_key = f"{coin}_{days}"
    now = time.time()

    if cache_key in CACHE["chart"] and now - CACHE["chart"][cache_key]["time"] < CACHE_TTL:
        return jsonify(CACHE["chart"][cache_key]["data"])

    result = coingecko_get(f"coins/{coin}/market_chart", {"vs_currency": "usd", "days": days})

    if result["status"] == "success":
        CACHE["chart"][cache_key] = {"time": now, "data": result["data"]}
        return jsonify(result["data"])

    return jsonify({"prices": []})


# ============================================================
# NEWS + FINBERT ANALYSIS
# ============================================================

def convert_to_wib(date_str):
    try:
        utc = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        wib = utc.astimezone(pytz.timezone("Asia/Jakarta"))
        return wib.strftime("%d %b %Y %H:%M:%S")
    except:
        return date_str


def fetch_crypto_news():
    now = time.time()

    if now - CACHE["news"]["time"] < CACHE_TTL:
        return CACHE["news"]["data"]

    url = f"https://newsdata.io/api/1/latest?apikey={NEWS_API_KEY}&q=crypto"

    try:
        r = requests.get(url, timeout=10)
        data = r.json()

        news_out = []

        if "results" in data:
            for item in data["results"]:

                title = item.get("title", "")
                if not title:
                    continue

                # FINBERT
                label, confidence = finbert_sentiment(title)

                news_out.append({
                    "text": title,
                    "sentiment": label,
                    "confidence": confidence,
                    "date": convert_to_wib(item.get("pubDate","")),
                    "country": ", ".join(item.get("country", [])),
                    "language": item.get("language", ""),
                    "category": ", ".join(item.get("category", [])),
                    "publisher": item.get("source_id", "")
                })

        CACHE["news"]["data"] = news_out
        CACHE["news"]["time"] = now

        return news_out

    except:
        return []

@app.route("/api/sentiment")
def get_sentiment():
    return jsonify(fetch_crypto_news())


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(debug=True, port=port, host="0.0.0.0")

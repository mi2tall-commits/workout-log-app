import urllib.request
import json
import time

api_key = 'AQ.Ab8RN6I72Dj0lVu4k9TVb2j-24rQVj5I2VAvPovlf7CntVEXlA'

# Let's list available models
url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
req = urllib.request.Request(url)
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        models = [m['name'] for m in data.get('models', []) if 'generateContent' in m.get('supportedGenerationMethods', [])]
        print("Available models:", models)
except Exception as e:
    print("List models error:", e)

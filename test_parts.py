import urllib.request
import json
import time

api_key = 'AQ.Ab8RN6I72Dj0lVu4k9TVb2j-24rQVj5I2VAvPovlf7CntVEXlA'
models = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.5-pro']

prompt = "Hello, write 1 motivational sentence in Korean for a runner."
payload = {'contents': [{'parts': [{'text': prompt}]}]}

for m in models:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key}"
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"Model {m} SUCCESS:")
            parts = data['candidates'][0]['content']['parts']
            print("Number of parts:", len(parts))
            for i, p in enumerate(parts):
                print(f"Part {i} (thought={p.get('thought', False)}):", p.get('text', '')[:100])
            break
    except Exception as e:
        print(f"Model {m} error:", e)

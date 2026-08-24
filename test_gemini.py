import urllib.request
import urllib.error
import json
import sys

api_key = 'AQ.Ab8RN6I72Dj0lVu4k9TVb2j-24rQVj5I2VAvPovlf7CntVEXlA'
models = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-3-flash-preview', 'gemini-1.5-flash']
versions = ['v1beta', 'v1']

for ver in versions:
    for m in models:
        url = f"https://generativelanguage.googleapis.com/{ver}/models/{m}:generateContent?key={api_key}"
        payload = {'contents': [{'parts': [{'text': 'hi'}]}]}
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req) as resp:
                print(f"SUCCESS! {ver} {m}")
                print(resp.read().decode('utf-8')[:200])
                sys.exit(0)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8')
            print(f"{ver} {m} error {e.code}: {err_body}")
        except Exception as e:
            print(f"{ver} {m} exp: {e}")

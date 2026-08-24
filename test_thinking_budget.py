import urllib.request
import json

api_key = 'AQ.Ab8RN6I72Dj0lVu4k9TVb2j-24rQVj5I2VAvPovlf7CntVEXlA'
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"

prompt = """너는 엘리트 마라토너이자 전문 수석 코치야. 다음 데이터를 바탕으로 코칭 분석 후기를 작성해줘.
- 거리: 3.19km, 페이스: 6'36", 심박수: 146bpm (최고 160), 케이던스: 160spm, 칼로리: 217kcal
규칙:
1. 생각 과정이나 영어 메모 없이, 오직 최종 결과인 한국어 코칭 분석 글만 출력할 것.
2. [📊 데이터 심층 분석]과 [💡 코치 처방 & 회복 가이드] 2개 소제목과 이모지로 구성할 것."""

payload = {
    'contents': [{'parts': [{'text': prompt}]}],
    'generationConfig': {
        'temperature': 0.7,
        'maxOutputTokens': 1000,
        'thinkingConfig': {
            'thinkingBudget': 0
        }
    }
}

req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print("Success with thinkingBudget=0!")
        parts = res['candidates'][0]['content']['parts']
        for i, p in enumerate(parts):
            print(f"Part {i}:", p.get('text'))
except Exception as e:
    print("Error with thinkingBudget=0:", e)

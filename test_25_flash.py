import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

api_key = 'AQ.Ab8RN6I72Dj0lVu4k9TVb2j-24rQVj5I2VAvPovlf7CntVEXlA'
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

prompt = """너는 엘리트 마라토너이자 산악 트레일런, 프리다이빙 전문 수석 코치야.
사용자가 Amazfit T-Rex 3 스마트워치로 측정한 다음 운동 데이터를 바탕으로, 운동 일지 '메모/후기'란에 바로 넣을 수 있는 감탄과 전문성이 느껴지는 코칭 분석 요약글을 작성해줘.

【운동 측정 데이터】
- 종목: 런닝
- 날짜: 2026-08-22
- 운동시간: 21분
- 이동거리: 3.19km
- 평균페이스: 6'36"/km
- 평균심박수: 146 bpm (최고 160 bpm)
- 소모칼로리: 217 kcal
- 평균케이던스: 160 spm
- 운동강도(RPE): 5/10

【작성 규칙】
1. 생각 과정(Thinking process)이나 영어 메모 없이, 오직 최종 결과인 한국어 코칭 분석 글만 출력할 것.
2. 3~4문장 내외로 군더더기 없이 임팩트 있고 전문적으로 작성할 것.
3. [📊 데이터 심층 분석]과 [💡 코치 처방 & 회복 가이드] 2개 소제목과 이모지로 구성할 것.
4. 심박 존(유산소 Zone 2~3), 케이던스(160spm에서 175~180spm 개선 팁), 페이스 등의 수치를 자연스럽게 인용해 칭찬과 실질적 피드백을 제공할 것.
5. 친절하고 활기찬 한국어 말투(~하셨습니다, ~추천합니다)로 작성할 것."""

payload = {
    'contents': [{'parts': [{'text': prompt}]}],
    'generationConfig': {
        'temperature': 0.7,
        'maxOutputTokens': 1000
    }
}

req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode('utf-8'))
    print("Response:")
    parts = res['candidates'][0]['content']['parts']
    for i, p in enumerate(parts):
        print(f"--- Part {i} ---")
        print(p.get('text'))

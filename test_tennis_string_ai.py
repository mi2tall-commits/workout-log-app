import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

api_key = 'AQ.Ab8RN6I72Dj0lVu4k9TVb2j-24rQVj5I2VAvPovlf7CntVEXlA'
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={api_key}"

prompt = """너는 세계적인 프로 테니스 스트링 기술자이자 스포츠 의학/장비 전문 수석 테니스 코치야.
사용자가 입력한 라켓/스트링 정보와 교체 이후 누적된 테니스 훈련 및 경기 기록을 정밀 분석하여, 스트링의 텐션 로스 상태와 최적의 교체 시점을 진단해줘.

【장착 스트링 사양】
- 교체 일자: 2026-06-15 (현재 70일 경과)
- 라켓 모델: 윌슨 블레이드 98 v9 (Wilson Blade 98)
- 스트링 모델: 럭실론 알루파워 1.25 (폴리 스트링)
- 세팅 텐션: 52/50 lbs
- 특이사항: 스트로크 위주 플레이어

【교체 이후 누적 플레이 데이터】
- 누적 코트 사용 시간: 24.5시간 (총 1,470분)
- 총 세션 수: 26회 (클럽게임 14회, 레슨 8회, 랠리연습 4회)
- 평균 운동 강도: RPE 6.8/10 (고강도 RPE 7+ 경기: 11회)
- 최근 메모 및 타구 피드백: "공이 전보다 약간 날림", "타구음이 먹먹함", "손목에 미세한 뻐근함 발생"

【분석 지침】
1. 스트링 종류별 물리적 특성(폴리 스트링은 15~20시간 후 텐션/탄성이 급격히 소실되는 '데드 폴리' 현상 발생)을 명확히 반영할 것.
2. 테니스 엘보/손목 부상 방지 관점에서 현재 스트링의 충격 흡수율 저하 위험도를 점검할 것.
3. [🎾 스트링 건강도 & 잔여 수명 점수 (0~100%)], [📊 누적 타구 & 텐션 로스 분석], [⚠️ 타구감 & 엘보 부상 위험 진단], [💡 맞춤 교체 권장 시점 & 세팅 팁] 4개 섹션으로 구성할 것.
4. 구체적인 교체 권장일/플레이 잔여 시간을 명시하고, 신뢰감 있고 친절한 전문 코치 어조로 작성할 것."""

payload = {
    'contents': [{'parts': [{'text': prompt}]}],
    'generationConfig': {
        'temperature': 0.7,
        'maxOutputTokens': 1500
    }
}

req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode('utf-8'))
    print("=== AI String Analysis Output ===")
    parts = res['candidates'][0]['content']['parts']
    for p in parts:
        print(p.get('text'))

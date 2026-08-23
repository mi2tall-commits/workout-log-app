import os
import sys
import urllib.request
import json

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

def test_api():
    base_url = "http://127.0.0.1:8623/api"
    
    # 1. Get logs
    req = urllib.request.urlopen(f"{base_url}/logs")
    logs = json.loads(req.read().decode('utf-8'))
    print(f"1. GET /api/logs: total {len(logs['logs'])} records found.")
    for l in logs['logs']:
        print(f"  - [{l['sport']}] {l['date']}: {l['title']}")

    # 2. Get stats
    req = urllib.request.urlopen(f"{base_url}/stats")
    stats = json.loads(req.read().decode('utf-8'))
    print("\n2. GET /api/stats overview:")
    print(json.dumps(stats['overview'], indent=2, ensure_ascii=False))

    # 3. Create a new test log (Freediving PB attempt)
    new_log = {
        "date": "2026-08-20",
        "sport": "freediving",
        "title": "K26 수심 트레이닝 개인 신기록 달성",
        "duration_minutes": 150,
        "intensity": 7,
        "condition_note": "호흡 주기 안정적, 압력 평형 순조로움",
        "weather": "실내",
        "temperature": 29.5,
        "notes": "30m 딥 다이빙 성공! 마우스필 충전 타이밍 완벽.",
        "freedive_depth": 30.5,
        "freedive_sta": "4'05\"",
        "dive_count": 16,
        "water_temp": 30.0,
        "discipline": "CWT",
        "suit_weight": "2mm / 1.5kg",
        "buddy": "박버디 마스터",
        "gear": "몰차노브 모노핀, 오머 마스크"
    }
    req = urllib.request.Request(
        f"{base_url}/logs",
        data=json.dumps(new_log).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    res = urllib.request.urlopen(req)
    created = json.loads(res.read().decode('utf-8'))
    print(f"\n3. POST /api/logs created id: {created.get('id')}")

    # 4. Check new stats (freediving max depth should be 30.5)
    req = urllib.request.urlopen(f"{base_url}/stats")
    updated_stats = json.loads(req.read().decode('utf-8'))
    print(f"\n4. Updated Freediving Max Depth PB: {updated_stats['overview']['freedive_max_depth']} m (Expected: 30.5)")
    assert updated_stats['overview']['freedive_max_depth'] == 30.5, "PB not updated!"

    # 5. Export test
    req = urllib.request.urlopen(f"{base_url}/export")
    exported = json.loads(req.read().decode('utf-8'))
    print(f"\n5. GET /api/export total exported: {len(exported['workouts'])}")

    print("\n[SUCCESS] All API Integration Tests Passed Successfully!")

if __name__ == "__main__":
    test_api()

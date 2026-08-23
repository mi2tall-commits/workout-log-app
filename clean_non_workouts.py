import sqlite3
import sys

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

DB_PATH = "workout_log.db"

# Words/Phrases that clearly indicate non-workout / rest / pilates / inactive days
NON_WORKOUT_KEYWORDS = [
    "농띠", "휴식", "쉼", "침대", "음주", "숙취", "방구석", "뭐했지", "허리 탈남",
    "필테", "필라테스", "근막이완", "굿볼", "수정샘", "수정 샘", "대타 선생님", "약사동",
    "우천이슈", "우천취소", "선거날", "서라벌", "스페셜만", "스페셜1", "오전 운동 無",
    "출근", "경영검토", "문수 방문", "스크린대결", "힐마루CC"
]

# Exceptions: if contains these keywords, it HAS a real workout even if some keyword above was mentioned
REAL_WORKOUT_OVERRIDE = [
    "19층 계단 오르기", "뒷산 등산", "문수산 우천 걷기", "유곡~수아 숙취해소용 걷기",
    "신불산~간월재", "입화산", "태화강", "런닝", "러닝", "등반", "수영", "잠영", "평영"
]

def clean_database():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, date, sport, title, notes, distance_km, duration_minutes FROM workouts ORDER BY date ASC")
    rows = cursor.fetchall()

    deleted_logs = []
    kept_logs = []

    for r in rows:
        log_id, date, sport, title, notes, dist, dur = r
        full_text = f"{title} {notes}".strip()

        # Check if it should be removed
        is_non_workout = False
        
        # 1. Matches non-workout keywords
        for kw in NON_WORKOUT_KEYWORDS:
            if kw in full_text:
                is_non_workout = True
                break
        
        # 2. Check if overridden by real workout content
        if is_non_workout:
            # Special check: e.g. "뒷산 등산 + 스페셜", "19층 계단 오르기", "문수산 우천 걷기", "숙취해소용 걷기 30분"
            if ("계단 오르기" in full_text or "뒷산 등산" in full_text or "우천 걷기" in full_text or 
                "숙취해소용 걷기" in full_text or "6km" in full_text or "7km" in full_text or "14km" in full_text):
                is_non_workout = False
        
        # 3. Check if notes are empty or trivial
        if not full_text:
            is_non_workout = True

        if is_non_workout:
            deleted_logs.append((log_id, date, sport, full_text[:40]))
        else:
            kept_logs.append((log_id, date, sport, full_text[:40]))

    # Perform Deletion
    del_ids = [d[0] for d in deleted_logs]
    if del_ids:
        cursor.execute(f"DELETE FROM workouts WHERE id IN ({','.join(['?']*len(del_ids))})", del_ids)
        conn.commit()

    print(f"==================================================")
    print(f"총 {len(rows)}건 중:")
    print(f"🗑️  삭제된 비운동/휴식/필테 기록: {len(deleted_logs)}건")
    print(f"✅  유지된 실제 운동 기록: {len(kept_logs)}건")
    print(f"==================================================")
    
    print("\n[🗑️ 삭제된 항목 목록]")
    for d in deleted_logs:
        print(f"  - {d[1]} [{d[2]}]: {d[3]}")

    print("\n[✅ 최종 보존된 실제 운동 기록]")
    for k in kept_logs:
        print(f"  + {k[1]} [{k[2]}]: {k[3]}")

    # Summary by sport
    print("\n[📊 종목별 최종 현황]")
    cursor.execute("SELECT sport, count(*), sum(distance_km), sum(duration_minutes), sum(elevation_gain) FROM workouts GROUP BY sport")
    for s in cursor.fetchall():
        print(f"  * {s[0]}: {s[1]}회 (거리: {s[2]:.1f}km, 시간: {s[3]}분, 고도: +{s[4]}m)")

    conn.close()

if __name__ == "__main__":
    clean_database()

import sqlite3
import csv
import os
import sys

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

DB_PATH = "workout_log.db"
CSV_PATH = "운동일지_GoogleDrive_업로드용.csv"

SPORT_KOREAN = {
    "running": "런닝",
    "hiking": "등산",
    "trail_running": "트레일런닝",
    "freediving": "프리다이빙",
    "walking": "걷기",
    "other": "기타"
}

def export_to_google_csv():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT date, sport, title, duration_minutes, intensity,
               distance_km, pace, elevation_gain, max_altitude,
               freedive_depth, discipline, location_course,
               weather, gear, notes
        FROM workouts
        ORDER BY date ASC
    """)
    rows = cursor.fetchall()
    conn.close()

    headers = [
        "날짜", "운동종목", "제목/코스요약", "소요시간(분)", "운동강도(RPE)",
        "이동거리(km)", "페이스", "누적상승고도(m)", "최고고도(m)",
        "수심(m)", "세부종목명", "장소/위치",
        "날씨", "착용장비", "운동메모"
    ]

    with open(CSV_PATH, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        for r in rows:
            date, sport, title, dur, rpe, dist, pace, elev, max_alt, depth, disc, loc, weather, gear, notes = r
            writer.writerow([
                date,
                SPORT_KOREAN.get(sport, sport),
                title or "",
                dur or 0,
                rpe or 5,
                dist if dist and dist > 0 else "",
                pace or "",
                elev if elev and elev > 0 else "",
                max_alt if max_alt and max_alt > 0 else "",
                depth if depth and depth > 0 else "",
                disc or "",
                loc or "",
                weather or "맑음",
                gear or "",
                notes or ""
            ])

    print(f"✅ 구글 드라이브 업로드용 CSV 생성 완료: {CSV_PATH} (총 {len(rows)}건)")

if __name__ == "__main__":
    export_to_google_csv()

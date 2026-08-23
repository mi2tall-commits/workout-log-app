import sqlite3
import re
import sys
from datetime import datetime

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

DB_PATH = "workout_log.db"

RAW_DATA = """
2026. 4. 1	수		소바우->에일린의뜰 언덕길 오르막길 걷기 총 4.9km.(50분 소요) 내일은 봉월공원으로 고고~
2026. 4. 2	목		SUA -> 남산 걷기 (왕복35분??) 생각 보다 계속 오르막이네? ㅋ
2026. 4. 3	금		농띠 농띠 아니거덩여 ㅋ 운동 방법을 바꿨을 뿐 쿄쿄
2026. 4. 7	화		수아->신정초 오르막 걷기 총 3.6km 에게게게
2026. 4. 8	수		봉원 공원 스텝 훈련. 줄넘기
2026. 4. 9	목		봉월 공원 스텝 훈련 맛뵈기. 나만 다리 후덜덜덜. 
2026. 4. 10	금		남산공원까지 뛰고 걷기
2026. 4. 14	화		남산공원까지 걷기
2026. 4. 15	수		음주 여파 휴식
2026. 4. 16	목		쉼
2026. 4. 17	금		
2026. 4. 19	일		절, 스쿼트 쬐매, 종갓집 도서관 걷기(책 반납)
2026. 4. 20	월		스페셜1
2026. 4. 21	화		19층 계단 오르기 2회 + 스페셜2
2026. 4. 22	수		19층 계단 오르기 3회 + 스페셜3
2026. 4. 23	목		스페셜만 4
2026. 4. 24	금		쉼
2026. 4. 28	화		
2026. 4. 29	수		
2026. 4. 30	목		
2026. 5. 6	수		첫 필라테스. 생각보다 팔뚝이 아프게 됨.
2026. 5. 7	목		남산까지 같이 걷기. 행복한 시간
2026. 5. 8	금		공 날라가기. 업~ 업~ 따라하기, 호흡 소리 내기 등등등. 코어 약해 약해
2026. 5. 11	월		관심 받기 호흡법 시전. 후우~ 끄응~ 선생님~. 출근 시 성대모사해서 빵 터지심
2026. 5. 12	화		뭐했지 모르겠네
2026. 5. 13	수		허리 탈남. 불안하면 과감히 포기하자
2026. 5. 14	목		뭐했지 모르겠네
2026. 5. 15	금		문수테니스장 걷기. 선물로 공 두개 전달(줍줍)
2026. 5. 17	일		유곡-수아 런닝 헥헥 
2026. 5. 18	월		인라인장 런닝. 새벽부터 인라인 하시는 어르신 두분. 피클볼 벽치기 하시는 어르신 한분 
2026. 5. 19	화		휴식 취하기
2026. 5. 20	수		허리 공 굴리기, 스페셜
2026. 5. 21	목		우천이슈
2026. 5. 22	금		대타 선생님 운동 프로그램 및 강의 스타일 굿! 회원들 다치지 않게 상세히 설명 및 관리
2026. 5. 23	토		
2026. 5. 24	일		서라벌
2026. 5. 25	월		
2026. 5. 26	화		아침에 남산 걷기, 저녁에 언덕 걷기 1.5만보
2026. 5. 27	수		수정샘 늦잠 의심 이슈로 필테 취소. 아침 휴식(우천 관계), 스페셜 3초 충격
2026. 5. 28	목		본의 아니게 뒷산 등산 + 스페셜
2026. 5. 29	금		역시 수정 샘은 무조건 뭘 해야 함 ㅋ
2026. 5. 30	토		
2026. 5. 31	일		
2026. 6. 1	월		
2026. 6. 2	화		우천이슈
2026. 6. 3	수		선거날
2026. 6. 4	목		문수테니스장 런닝(인터벌 쪼메 만에 지침)
2026. 6. 5	금		남산 왼손 첫 연습. 안되네.
2026. 6. 6	토		
2026. 6. 7	일		문수산 우천 걷기
2026. 6. 8	월		휴식
2026. 6. 9	화		테니스장 및 축구장 주변 러닝+빠르게 걷기 (6km)
2026. 6. 10	수		야음에서 랠리 및 숏게임 대결 승리! (양손 포핸드 백핸드) 후!!!!!!!!!!!!
2026. 6. 11	목		음주 여파로 트렁크에서 누버서 휴식
2026. 6. 12	금		1.5만보인데 기억이 안나네 머했지
2026. 6. 13	토		
2026. 6. 14	일		남산 ~ 무거동 2시간 반? 왜 꼴랑 1.2만보지 ㅎㅎ
2026. 6. 15	월		아침 수아-> 남산루만 살짝, 대회 피로 회복용 마사지 실시해 드림
2026. 6. 16	화		침대축구
2026. 6. 17	수		"남산루-태화강전망대 오붓한 시간~ 3km / 스페셜2, 유곡~남산 런닝 땀 뻘뻘
남산 밑에 편의점에서 기다리다가 플레이 볼려고 올라 갔는데 때마침 종료하여 접선 "
2026. 6. 18	목		문수 40분 걷기, 약간 피곤스~
2026. 6. 19	금		백만년만에스크린대결. 
2026. 6. 20	토		"창녕 힐마루CC 우천 라운딩. 120개 치기 대작전. 백돌이들과 치기 힘들다는 박군의 푸념. 
골프도 안되고 테니스도 못하고 에라이"
2026. 6. 21	일		태화강 걷기 1.5hr
2026. 6. 22	월		태화강 7km 러닝 (한계인가) + 2km 걷기
2026. 6. 23	화		"아침 30분 문수테니스장 걷기.
7월 필테 등록해서 다행(누군가는 등록 못하게 되어 지송~~)"
2026. 6. 24	수		침대축구
2026. 6. 25	목		문수테니스장 걷기 40분/태화강~삼호교~물고기다리 7km 런닝 and 수아까지 걷기, 2.1만보(총 19km)
2026. 6. 26	금		"유곡~수아 숙취해소용 걷기 30분, 스페셜 복구 안됨 두둥. 시계 분실 사건 발생
분리수거장을 두시간 넘게 찾았지만 그는 떠나고 없었다. 정신머리 하고는...자존감 하락
호연이 한테 폰 잃어 버렸을 때 혼낸거 사과함. 오히려 호연이가 위로함. 괜찮다고
켜지지 않는 시계. 차라리 누가 주워서 써라 마. 그게 마음이 덜 아프것다."
2026. 6. 27	토		"유곡~수아 런닝. 대회 출발 전 잠깐 보기
대회하는 걸 full로 보고 싶지만 방법이 없네 (짱구를 좀 굴려보자)
멀리서 마음으로만 응원! 한단계 결과가 올라서 만족. 우승은 다음 기회에
연락이 안되서 궁금한 것도 많았음 ㅎㅎ;
"
2026. 6. 28	일		"신불산~간월재 등반. 1.6만보, 14km. 255 계단 오르기 수준이라네. 신불산은 언제 다시 도전 해보려나.,,
젊은 시절 관절, 체력 생각은 버리거라. 나이 듦을 인정하라. 
높은산이건 낮은산이건 항상 힘들다. 산은 산이다.
외롭고 힘든 등산이지만 새벽에 일어나 긴 시간을 보내려면 이 방법 뿐"
2026. 6. 29	월		"오전 운동 無
꼭두 새벽에 출발했는지 몰랐네. 뒤에 보니 셋로그에 있었네. 문이 자동으로 열려서 깜놀. 
아침 먹고 출발하는 줄 알고 두왕에 플랜카드 인증샷 찍으러 갈려다 아침 전해주려 들렀는데 잘했네.
(알고보니 플랜카드가 사라졌다는... 두둥)
다행히 간단한 아침 식사 같이함. 대회에선 잼있는 애피소드가 많았네...
HT군은 잘 관리해서 복귀해야 할긴데. 걱정이 되는 구만."
2026. 6. 30	화		"문수테니스장 런닝. 오늘은 사람이 없네. 6km로 나오는데 그정도는 안뛴거 같은데.
오늘이 화목 새벽 런닝 마지막 day. 이제 필테로 복귀! 수정샘 지발 안다치게 살펴 주셔요
수강신청 잘하자 마!"
2026. 7. 1	수		"우천취소.
굿볼 근막이완 및 체형관리 첫 수강. 이완이 되는건지는 모르겠지만 평소 압력이 아니라 어색 어색"
2026. 7. 2	목		"한달만에 필테. 인원이 바껴서 평균 나이 down.
생각보다 덜 힘드네?? 나도 이제 덜힘듬 ㅋㅋㅋ 요령인가 근육이 생긴건가... 후자라고 믿어보장 
왜냐면 나는 세번째달 수강생이거든 (오늘 동작이 좀 안힘든거엿낭...???) 여튼 같이 해서 넘 좋음
저녁 하이오 접선"
2026. 7. 3	금		오전 휴식
2026. 7. 4	토		"약사동 필테. 몸에 너무 무리가 가는 듯. 취소함.
샘도 내가 잘 따라하는 줄 알고 막 눌러서 돌리심. 으읔"
2026. 7. 5	일		온종일 휴식 했으나, 저녁 7시 반에 취침해버림
2026. 7. 6	월		"5km 정도 수아~신정중학교~옥동 걷기. 습도가 높아 땀 줄줄
내일 필테인데 무릎이랑 허리가 좀 나아야 할 긴데."
2026. 7. 7	화		"다리 달달달, Bar 떨어뜨려서 오른쪽 정강이 타격, 호흡 소리 내기
언제까지 관심 받고 싶은 것이냐
유곡->중구수영장 걷기 ㅋㅋ ㅋㅋㅋㅋㅋㅋㅋㅋ"
2026. 7. 8	수		휴식
2026. 7. 9	목		"경영검토 준비 회사 조출
저녁은 술자리. 결국 12시를 기어코 넘김"
2026. 7. 10	금		숙취 휴식
2026. 7. 11	토		휴식. 설호연 학원 안가심. 포항 안간다고 해서 혼자 다녀 오심. 분위기 살벌~~
2026. 7. 12	일		"문수산 깔딱고개 전까지 걷기. 다리와 허리가 무거웠던 하루
하산 중 마지막에 잘 못 들어가서 다른 동네로 갈뻔...
필테 안가심"
2026. 7. 13	월		"수아~신정중학교 슬로우 런닝이후 침대 휴식.
다리가 아직 묵직 왜 글치"
2026. 7. 14	화		휴식
2026. 7. 15	수		침대 눈알 운동
2026. 7. 16	목		오늘도 농띠
2026. 7. 17	금		오늘도 농띠
2026. 7. 18	토		"영남알프스-홍류폭포 간단 등반
혼자 갈때는 물이 많드만, 애랑 같이 가니 실폭포였음.
길 여쭤봤던 할배는 거 볼거도 음따 하셨는데 말을 들을거를 ㅋ
"
2026. 7. 19	일		"유곡테니스장-입화산(204m) 뛰어서 등반 20분 소요. 심장 터질 뻔(마지막 깔딱 고개)
KOREA 아저씨는 왕복으로 트레일런닝 하시던데. 대단스"
2026. 7. 20	월		오늘도 농띠
2026. 7. 21	화		오늘도 농띠
2026. 7. 22	수		오늘도 농띠
2026. 7. 23	목		간만에 필테. 샘 말 안듣고 맘 대로 한다고 혼남(by 시버러버)
2026. 7. 24	금		오늘도 농띠.
2026. 7. 25	토		"포항 전복 뿔소라 잡이 2일간 실시. 무리해서 허리 삐끗.
역시 전복은 한번에 못 잡으면 개고생"
2026. 7. 26	일		
2026. 7. 27	월		농띠
2026. 7. 28	화		문수테니스장 걷기
2026. 7. 29	수		수아 - 신정중학교 런닝. 30분. 땀 범벅
2026. 7. 30	목		필테. 
2026. 7. 31	금		숙취 휴식
2026. 8. 1	토		
2026. 8. 2	일		
2026. 8. 3	월		
2026. 8. 4	화		수영 12분. 꼴랑 저거에 피곤스
2026. 8. 5	수		수영 15분. 꼴랑 저거에 또 피곤스
2026. 8. 6	목		평영 100m, 발차기 50m, 자유영 50m, 잠영 100m 연습
2026. 8. 7	금		음주 여파 휴식
2026. 8. 8	토		방구석
2026. 8. 9	일		방구석
2026. 8. 10	월		
2026. 8. 11	화		문수 방문
2026. 8. 12	수		조기 출근 후 업무
2026. 8. 13	목		
2026. 8. 14	금	런닝	북구 순환도로 30분 런닝
2026. 8. 15	토		
2026. 8. 16	일		
2026. 8. 17	월	런닝	태화강 6km. 30분 런닝 후 걷기 총 1hr
2026. 8. 18	화	런닝	북부순환도로 30분 런닝
"""

# Workout detection function
def classify_entry(content):
    c = content.strip()
    if not c:
        return None # Empty day

    # Check for pure non-workout keywords
    pure_rest_keywords = [
        "농띠", "휴식", "쉼", "침대축구", "침대 눈알", "음주 여파", "숙취", "방구석",
        "뭐했지", "허리 탈남", "우천이슈", "우천취소", "선거날", "서라벌",
        "스페셜1", "스페셜만", "오전 운동 無", "조기 출근", "경영검토", "문수 방문",
        "백만년만에스크린대결", "창녕 힐마루CC"
    ]

    # Explicit actual workout indicators
    is_actual_workout = False
    workout_indicators = [
        "걷기", "런닝", "러닝", "등반", "등산", "뛰어서 등반", "스텝 훈련", "줄넘기",
        "계단 오르기", "수영", "잠영", "평영", "전복", "뿔소라", "만보", "뛰고 걷기",
        "랠리 및 숏게임", "왼손 첫 연습"
    ]

    for ind in workout_indicators:
        if ind in c:
            is_actual_workout = True
            break

    # If it is only Pilates/Stretching with no walking/running/etc
    if ("필테" in c or "필라테스" in c or "굿볼" in c or "근막이완" in c or "공 날라가기" in c or "호흡법 시전" in c or "허리 공 굴리기" in c):
        if not is_actual_workout:
            return None # Pure Pilates/Stretching -> Filter out

    if not is_actual_workout:
        # Check pure rest
        for rk in pure_rest_keywords:
            if rk in c:
                return None
        return None

    # Classify sport
    if "트레일" in c or "입화산" in c or "뛰어서 등반" in c:
        sport = "trail_running"
    elif "런닝" in c or "러닝" in c or "뛰고" in c or "인터벌" in c:
        sport = "running"
    elif "등반" in c or "등산" in c or "신불산" in c or "간월재" in c or "홍류폭포" in c or "문수산" in c or "뒷산" in c:
        sport = "hiking"
    elif "수영" in c or "잠영" in c or "평영" in c or "전복" in c or "뿔소라" in c:
        sport = "freediving"
    else:
        sport = "walking"

    return sport

def process_and_reseed():
    lines = RAW_DATA.strip().split("\n")
    entries = []
    
    current_entry = ""
    for line in lines:
        if re.match(r"^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}", line.strip()):
            if current_entry:
                entries.append(current_entry.strip())
            current_entry = line
        else:
            current_entry += "\n" + line
    if current_entry:
        entries.append(current_entry.strip())

    real_workouts = []
    filtered_out = []

    for entry in entries:
        m = re.match(r"^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\s+([월화수목금토일])\s*(.*)$", entry, re.DOTALL)
        if not m:
            continue
        
        year, month, day, day_of_week, rest = m.groups()
        date_str = f"{year}-{int(month):02d}-{int(day):02d}"
        
        rest = rest.strip()
        if not rest:
            continue

        parts = rest.split("\t")
        content = "\t".join(parts[1:]).strip() if len(parts) >= 2 and parts[0].strip() in ["런닝", "등산", "걷기", "트레일런닝", "프리다이빙", "수영"] else rest.strip()
        if content.startswith('"') and content.endswith('"'):
            content = content[1:-1].strip()

        sport = classify_entry(content)
        if not sport:
            filtered_out.append((date_str, content.split('\n')[0]))
            continue

        # Extract Metrics
        distance_km = 0.0
        dist_m = re.search(r"(\d+(?:\.\d+)?)\s*km", content, re.IGNORECASE)
        if dist_m:
            distance_km = float(dist_m.group(1))
        
        step_m = re.search(r"(\d+(?:\.\d+)?)\s*만보", content)
        if step_m and distance_km == 0.0:
            distance_km = round(float(step_m.group(1)) * 6.5, 1)

        # Duration
        duration_minutes = 0
        dur_min_m = re.search(r"(\d+)\s*분", content)
        dur_hr_m = re.search(r"(\d+(?:\.\d+)?)\s*(?:시간|hr)", content)
        if dur_min_m:
            duration_minutes += int(dur_min_m.group(1))
        if dur_hr_m:
            duration_minutes += int(float(dur_hr_m.group(1)) * 60)
        
        if duration_minutes == 0:
            if distance_km > 0:
                duration_minutes = int(distance_km * (6 if sport == "running" else 12))
            elif "수영" in content:
                duration_minutes = 20
            elif "계단 오르기" in content:
                duration_minutes = 25
            else:
                duration_minutes = 35

        # Elevation
        elevation_gain = 0
        max_altitude = 0
        if sport in ["hiking", "trail_running"]:
            if "신불산" in content or "간월재" in content:
                elevation_gain = 750
                max_altitude = 1159
            elif "입화산" in content:
                elevation_gain = 180
                max_altitude = 204
            elif "문수산" in content:
                elevation_gain = 400
                max_altitude = 600
            elif "홍류폭포" in content:
                elevation_gain = 250
            else:
                elevation_gain = 200

        # Location
        location_course = ""
        for loc in ["태화강", "문수테니스장", "문수산", "남산공원", "남산", "신불산~간월재", "입화산", "유곡", "수아", "소바우", "봉월공원", "북구 순환도로", "북부순환도로", "영남알프스", "포항"]:
            if loc in content:
                location_course = loc
                break

        # Pace
        pace = ""
        if distance_km > 0 and duration_minutes > 0 and (sport in ["running", "walking", "trail_running"]):
            pace_min_per_km = duration_minutes / distance_km
            p_m = int(pace_min_per_km)
            p_s = int(round((pace_min_per_km - p_m) * 60))
            if p_m < 30:
                pace = f"{p_m}'{p_s:02d}\""

        # Intensity
        intensity = 6
        if "심장 터질" in content or "한계" in content or "다리 후덜" in content:
            intensity = 9
        elif "헥헥" in content or "땀 뻘뻘" in content or "땀 범벅" in content:
            intensity = 8
        elif "가벼" in content or "산책" in content or "오붓한" in content:
            intensity = 4

        title = content.split("\n")[0][:40]

        real_workouts.append({
            "date": date_str,
            "sport": sport,
            "title": title,
            "duration_minutes": duration_minutes,
            "intensity": intensity,
            "condition_note": f"{day_of_week}요일 운동",
            "weather": "비" if "우천" in content else "맑음",
            "temperature": None,
            "notes": content,
            "distance_km": distance_km,
            "pace": pace,
            "elevation_gain": elevation_gain,
            "max_altitude": max_altitude,
            "location_course": location_course,
            "freedive_depth": 3.0 if "전복" in content or "잠영" in content else 0,
            "discipline": "해양 채집" if "전복" in content else ("수영/잠영" if "수영" in content or "잠영" in content else ""),
            "created_at": datetime.now().isoformat()
        })

    # Save to SQLite DB
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM workouts")
    
    for r in real_workouts:
        cursor.execute("""
            INSERT INTO workouts (
                date, sport, title, duration_minutes, intensity, condition_note, weather, temperature, notes,
                distance_km, pace, avg_hr, max_hr, cadence,
                elevation_gain, max_altitude, location_course, rest_minutes, pack_weight, trail_condition,
                freedive_depth, freedive_sta, dive_count, water_temp, discipline, suit_weight, buddy,
                gear, custom_data, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            r["date"], r["sport"], r["title"], r["duration_minutes"], r["intensity"], r["condition_note"],
            r["weather"], r["temperature"], r["notes"], r["distance_km"], r["pace"], None, None, None,
            r["elevation_gain"], r["max_altitude"], r["location_course"], 0, None, "",
            r["freedive_depth"], "", 0, None, r["discipline"], "", "", "", "{}", r["created_at"]
        ))
    conn.commit()

    print(f"==================================================")
    print(f"총 {len(entries)}개 원본 일지 중:")
    print(f"🗑️  제외된 비운동/휴식/필테 일지: {len(filtered_out)}건")
    print(f"✅  최종 등록된 순수 실제 운동: {len(real_workouts)}건")
    print(f"==================================================")
    
    cursor.execute("SELECT sport, count(*), sum(distance_km), sum(duration_minutes), sum(elevation_gain) FROM workouts GROUP BY sport")
    for s in cursor.fetchall():
        print(f"  * {s[0]}: {s[1]}회 (거리: {s[2]:.1f}km, 시간: {s[3]}분, 고도: +{s[4]}m)")

    conn.close()

if __name__ == "__main__":
    process_and_reseed()

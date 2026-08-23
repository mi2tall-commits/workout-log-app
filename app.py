import os
import sys
import json
import sqlite3
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from datetime import datetime

# Configure UTF-8 stdout for Windows consoles
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

PORT = 8623
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DB_PATH = os.path.join(BASE_DIR, "workout_log.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS workouts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            sport TEXT NOT NULL,
            title TEXT,
            duration_minutes INTEGER DEFAULT 0,
            intensity INTEGER DEFAULT 5,
            condition_note TEXT,
            weather TEXT,
            temperature REAL,
            notes TEXT,
            -- Running / Walking
            distance_km REAL DEFAULT 0,
            pace TEXT,
            avg_hr INTEGER,
            max_hr INTEGER,
            cadence INTEGER,
            -- Hiking / Trail Running
            elevation_gain INTEGER DEFAULT 0,
            max_altitude INTEGER DEFAULT 0,
            location_course TEXT,
            rest_minutes INTEGER DEFAULT 0,
            pack_weight REAL,
            trail_condition TEXT,
            -- Freediving
            freedive_depth REAL DEFAULT 0,
            freedive_sta TEXT,
            dive_count INTEGER DEFAULT 0,
            water_temp REAL,
            discipline TEXT,
            suit_weight TEXT,
            buddy TEXT,
            -- Gear & Extra JSON
            gear TEXT,
            custom_data TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


class WorkoutAppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        raw = self.rfile.read(content_length).decode("utf-8")
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query = urllib.parse.parse_qs(parsed_url.query)

        if path == "/api/logs":
            self.handle_get_logs(query)
        elif path.startswith("/api/logs/"):
            log_id = path.split("/")[-1]
            self.handle_get_log_detail(log_id)
        elif path == "/api/stats":
            self.handle_get_stats()
        elif path == "/api/export":
            self.handle_export()
        else:
            # Serve static files
            super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path == "/api/logs":
            self.handle_create_log()
        elif path == "/api/import":
            self.handle_import()
        else:
            self._send_json({"error": "Not Found"}, status=404)

    def do_PUT(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path.startswith("/api/logs/"):
            log_id = path.split("/")[-1]
            self.handle_update_log(log_id)
        else:
            self._send_json({"error": "Not Found"}, status=404)

    def do_DELETE(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path.startswith("/api/logs/"):
            log_id = path.split("/")[-1]
            self.handle_delete_log(log_id)
        else:
            self._send_json({"error": "Not Found"}, status=404)

    # API Handlers
    def handle_get_logs(self, query):
        conn = get_db()
        cursor = conn.cursor()

        sql = "SELECT * FROM workouts WHERE 1=1"
        params = []

        sport = query.get("sport", [None])[0]
        if sport and sport != "all":
            sql += " AND sport = ?"
            params.append(sport)

        search = query.get("search", [None])[0]
        if search:
            sql += " AND (title LIKE ? OR notes LIKE ? OR location_course LIKE ? OR gear LIKE ?)"
            term = f"%{search}%"
            params.extend([term, term, term, term])

        start_date = query.get("startDate", [None])[0]
        if start_date:
            sql += " AND date >= ?"
            params.append(start_date)

        end_date = query.get("endDate", [None])[0]
        if end_date:
            sql += " AND date <= ?"
            params.append(end_date)

        sql += " ORDER BY date DESC, id DESC"

        cursor.execute(sql, params)
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()
        self._send_json({"logs": rows, "count": len(rows)})

    def handle_get_log_detail(self, log_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workouts WHERE id = ?", (log_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            self._send_json(dict(row))
        else:
            self._send_json({"error": "Workout not found"}, status=404)

    def handle_create_log(self):
        data = self._read_json()
        if not data.get("date") or not data.get("sport"):
            self._send_json({"error": "Date and Sport are required."}, status=400)
            return

        conn = get_db()
        cursor = conn.cursor()
        now_str = datetime.now().isoformat()

        cursor.execute("""
            INSERT INTO workouts (
                date, sport, title, duration_minutes, intensity, condition_note, weather, temperature, notes,
                distance_km, pace, avg_hr, max_hr, cadence,
                elevation_gain, max_altitude, location_course, rest_minutes, pack_weight, trail_condition,
                freedive_depth, freedive_sta, dive_count, water_temp, discipline, suit_weight, buddy,
                gear, custom_data, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("date"),
            data.get("sport"),
            data.get("title", ""),
            int(data.get("duration_minutes") or 0),
            int(data.get("intensity") or 5),
            data.get("condition_note", ""),
            data.get("weather", ""),
            float(data.get("temperature") or 0) if data.get("temperature") is not None and data.get("temperature") != "" else None,
            data.get("notes", ""),
            float(data.get("distance_km") or 0) if data.get("distance_km") is not None and data.get("distance_km") != "" else 0,
            data.get("pace", ""),
            int(data.get("avg_hr") or 0) if data.get("avg_hr") else None,
            int(data.get("max_hr") or 0) if data.get("max_hr") else None,
            int(data.get("cadence") or 0) if data.get("cadence") else None,
            int(data.get("elevation_gain") or 0) if data.get("elevation_gain") else 0,
            int(data.get("max_altitude") or 0) if data.get("max_altitude") else 0,
            data.get("location_course", ""),
            int(data.get("rest_minutes") or 0) if data.get("rest_minutes") else 0,
            float(data.get("pack_weight") or 0) if data.get("pack_weight") else None,
            data.get("trail_condition", ""),
            float(data.get("freedive_depth") or 0) if data.get("freedive_depth") else 0,
            data.get("freedive_sta", ""),
            int(data.get("dive_count") or 0) if data.get("dive_count") else 0,
            float(data.get("water_temp") or 0) if data.get("water_temp") else None,
            data.get("discipline", ""),
            data.get("suit_weight", ""),
            data.get("buddy", ""),
            data.get("gear", ""),
            json.dumps(data.get("custom_data", {})),
            now_str
        ))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        self._send_json({"success": True, "id": new_id}, status=201)

    def handle_update_log(self, log_id):
        data = self._read_json()
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE workouts SET
                date = ?, sport = ?, title = ?, duration_minutes = ?, intensity = ?,
                condition_note = ?, weather = ?, temperature = ?, notes = ?,
                distance_km = ?, pace = ?, avg_hr = ?, max_hr = ?, cadence = ?,
                elevation_gain = ?, max_altitude = ?, location_course = ?, rest_minutes = ?,
                pack_weight = ?, trail_condition = ?, freedive_depth = ?, freedive_sta = ?,
                dive_count = ?, water_temp = ?, discipline = ?, suit_weight = ?, buddy = ?,
                gear = ?, custom_data = ?
            WHERE id = ?
        """, (
            data.get("date"),
            data.get("sport"),
            data.get("title", ""),
            int(data.get("duration_minutes") or 0),
            int(data.get("intensity") or 5),
            data.get("condition_note", ""),
            data.get("weather", ""),
            float(data.get("temperature") or 0) if data.get("temperature") is not None and data.get("temperature") != "" else None,
            data.get("notes", ""),
            float(data.get("distance_km") or 0) if data.get("distance_km") is not None and data.get("distance_km") != "" else 0,
            data.get("pace", ""),
            int(data.get("avg_hr") or 0) if data.get("avg_hr") else None,
            int(data.get("max_hr") or 0) if data.get("max_hr") else None,
            int(data.get("cadence") or 0) if data.get("cadence") else None,
            int(data.get("elevation_gain") or 0) if data.get("elevation_gain") else 0,
            int(data.get("max_altitude") or 0) if data.get("max_altitude") else 0,
            data.get("location_course", ""),
            int(data.get("rest_minutes") or 0) if data.get("rest_minutes") else 0,
            float(data.get("pack_weight") or 0) if data.get("pack_weight") else None,
            data.get("trail_condition", ""),
            float(data.get("freedive_depth") or 0) if data.get("freedive_depth") else 0,
            data.get("freedive_sta", ""),
            int(data.get("dive_count") or 0) if data.get("dive_count") else 0,
            float(data.get("water_temp") or 0) if data.get("water_temp") else None,
            data.get("discipline", ""),
            data.get("suit_weight", ""),
            data.get("buddy", ""),
            data.get("gear", ""),
            json.dumps(data.get("custom_data", {})),
            log_id
        ))
        conn.commit()
        conn.close()
        self._send_json({"success": True})

    def handle_delete_log(self, log_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM workouts WHERE id = ?", (log_id,))
        conn.commit()
        conn.close()
        self._send_json({"success": True})

    def handle_get_stats(self):
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*), SUM(duration_minutes) FROM workouts")
        total_workouts, total_time = cursor.fetchone()

        cursor.execute("SELECT sport, COUNT(*) FROM workouts GROUP BY sport")
        sport_counts = {row[0]: row[1] for row in cursor.fetchall()}

        cursor.execute("SELECT SUM(distance_km) FROM workouts WHERE sport IN ('running', 'walking')")
        total_run_walk_km = cursor.fetchone()[0] or 0

        cursor.execute("SELECT SUM(distance_km), MAX(distance_km) FROM workouts WHERE sport = 'running'")
        run_row = cursor.fetchone()
        running_total_km = run_row[0] or 0
        running_max_km = run_row[1] or 0

        cursor.execute("SELECT SUM(elevation_gain), MAX(elevation_gain), SUM(distance_km) FROM workouts WHERE sport IN ('hiking', 'trail_running')")
        hike_row = cursor.fetchone()
        total_elevation = hike_row[0] or 0
        max_elevation = hike_row[1] or 0
        total_hike_km = hike_row[2] or 0

        cursor.execute("SELECT MAX(freedive_depth), COUNT(*) FROM workouts WHERE sport = 'freediving'")
        fd_row = cursor.fetchone()
        freedive_max_depth = fd_row[0] or 0
        freedive_total_sessions = fd_row[1] or 0

        cursor.execute("""
            SELECT strftime('%Y-%m', date) as month,
                   sport,
                   COUNT(*) as count,
                   SUM(distance_km) as distance,
                   SUM(elevation_gain) as elevation,
                   MAX(freedive_depth) as max_depth
            FROM workouts
            GROUP BY month, sport
            ORDER BY month ASC
        """)
        monthly_raw = cursor.fetchall()
        monthly_stats = []
        for r in monthly_raw:
            monthly_stats.append({
                "month": r[0],
                "sport": r[1],
                "count": r[2],
                "distance": round(r[3] or 0, 1),
                "elevation": r[4] or 0,
                "max_depth": r[5] or 0
            })

        cursor.execute("SELECT * FROM workouts ORDER BY date DESC, id DESC LIMIT 5")
        recent = [dict(row) for row in cursor.fetchall()]

        conn.close()

        self._send_json({
            "overview": {
                "total_workouts": total_workouts or 0,
                "total_duration_hours": round((total_time or 0) / 60, 1),
                "running_total_km": round(running_total_km, 1),
                "running_max_km": round(running_max_km, 1),
                "total_run_walk_km": round(total_run_walk_km, 1),
                "total_elevation_gain": total_elevation,
                "max_elevation_gain": max_elevation,
                "total_hike_km": round(total_hike_km, 1),
                "freedive_max_depth": freedive_max_depth,
                "freedive_total_sessions": freedive_total_sessions,
                "sport_counts": sport_counts
            },
            "monthly_trends": monthly_stats,
            "recent": recent
        })

    def handle_export(self):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workouts ORDER BY date ASC, id ASC")
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()
        export_data = {
            "version": "1.0",
            "exported_at": datetime.now().isoformat(),
            "workouts": rows
        }
        self._send_json(export_data)

    def handle_import(self):
        payload = self._read_json()
        workouts = payload.get("workouts", [])
        if not workouts:
            self._send_json({"error": "No workout records found in payload."}, status=400)
            return

        conn = get_db()
        cursor = conn.cursor()
        count = 0
        now_str = datetime.now().isoformat()

        for data in workouts:
            if not data.get("date") or not data.get("sport"):
                continue
            cursor.execute("""
                INSERT INTO workouts (
                    date, sport, title, duration_minutes, intensity, condition_note, weather, temperature, notes,
                    distance_km, pace, avg_hr, max_hr, cadence,
                    elevation_gain, max_altitude, location_course, rest_minutes, pack_weight, trail_condition,
                    freedive_depth, freedive_sta, dive_count, water_temp, discipline, suit_weight, buddy,
                    gear, custom_data, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get("date"),
                data.get("sport"),
                data.get("title", ""),
                int(data.get("duration_minutes") or 0),
                int(data.get("intensity") or 5),
                data.get("condition_note", ""),
                data.get("weather", ""),
                float(data.get("temperature") or 0) if data.get("temperature") is not None and data.get("temperature") != "" else None,
                data.get("notes", ""),
                float(data.get("distance_km") or 0) if data.get("distance_km") is not None and data.get("distance_km") != "" else 0,
                data.get("pace", ""),
                int(data.get("avg_hr") or 0) if data.get("avg_hr") else None,
                int(data.get("max_hr") or 0) if data.get("max_hr") else None,
                int(data.get("cadence") or 0) if data.get("cadence") else None,
                int(data.get("elevation_gain") or 0) if data.get("elevation_gain") else 0,
                int(data.get("max_altitude") or 0) if data.get("max_altitude") else 0,
                data.get("location_course", ""),
                int(data.get("rest_minutes") or 0) if data.get("rest_minutes") else 0,
                float(data.get("pack_weight") or 0) if data.get("pack_weight") else None,
                data.get("trail_condition", ""),
                float(data.get("freedive_depth") or 0) if data.get("freedive_depth") else 0,
                data.get("freedive_sta", ""),
                int(data.get("dive_count") or 0) if data.get("dive_count") else 0,
                float(data.get("water_temp") or 0) if data.get("water_temp") else None,
                data.get("discipline", ""),
                data.get("suit_weight", ""),
                data.get("buddy", ""),
                data.get("gear", ""),
                json.dumps(data.get("custom_data", {})) if isinstance(data.get("custom_data"), dict) else (data.get("custom_data") or "{}"),
                data.get("created_at") or now_str
            ))
            count += 1

        conn.commit()
        conn.close()
        self._send_json({"success": True, "imported_count": count})


def main():
    os.makedirs(STATIC_DIR, exist_ok=True)
    os.makedirs(os.path.join(STATIC_DIR, "css"), exist_ok=True)
    os.makedirs(os.path.join(STATIC_DIR, "js"), exist_ok=True)
    init_db()

    server_address = ("", PORT)
    httpd = ThreadingHTTPServer(server_address, WorkoutAppHandler)
    print("==================================================")
    print(f"[Workout App Server Started]")
    print(f"URL: http://localhost:{PORT}")
    print(f"Database: {DB_PATH}")
    print("==================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()


if __name__ == "__main__":
    main()

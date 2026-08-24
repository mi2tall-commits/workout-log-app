import math
from datetime import datetime

sample_gpx = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Zepp App" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Outdoor Running</name>
    <type>running</type>
    <trkseg>
      <trkpt lat="35.5384" lon="129.3114">
        <ele>45.2</ele>
        <time>2026-08-24T06:30:00Z</time>
      </trkpt>
      <trkpt lat="35.5420" lon="129.3150">
        <ele>52.0</ele>
        <time>2026-08-24T06:35:00Z</time>
      </trkpt>
      <trkpt lat="35.5480" lon="129.3200">
        <ele>60.5</ele>
        <time>2026-08-24T06:42:00Z</time>
      </trkpt>
      <trkpt lat="35.5550" lon="129.3280">
        <ele>48.0</ele>
        <time>2026-08-24T06:50:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>
"""

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# Test parsing logic in Python
import xml.etree.ElementTree as ET

root = ET.fromstring(sample_gpx)
ns = {'gpx': 'http://www.topografix.com/GPX/1/1'}
trkpts = root.findall('.//gpx:trkpt', ns) or root.findall('.//trkpt')

pts = []
for pt in trkpts:
    lat = float(pt.get('lat'))
    lon = float(pt.get('lon'))
    ele_elem = pt.find('gpx:ele', ns) if pt.find('gpx:ele', ns) is not None else pt.find('ele')
    time_elem = pt.find('gpx:time', ns) if pt.find('gpx:time', ns) is not None else pt.find('time')
    ele = float(ele_elem.text) if ele_elem is not None else 0.0
    t_str = time_elem.text if time_elem is not None else ""
    pts.append({'lat': lat, 'lon': lon, 'ele': ele, 'time': t_str})

dist = 0.0
gain = 0.0
max_alt = pts[0]['ele']
min_alt = pts[0]['ele']

for i in range(len(pts) - 1):
    d = haversine(pts[i]['lat'], pts[i]['lon'], pts[i+1]['lat'], pts[i+1]['lon'])
    dist += d
    de = pts[i+1]['ele'] - pts[i]['ele']
    if de > 0:
        gain += de
    max_alt = max(max_alt, pts[i+1]['ele'])
    min_alt = min(min_alt, pts[i+1]['ele'])

t0 = datetime.fromisoformat(pts[0]['time'].replace('Z', '+00:00'))
t1 = datetime.fromisoformat(pts[-1]['time'].replace('Z', '+00:00'))
dur_min = round((t1 - t0).total_seconds() / 60)

pace_min_km = dur_min / dist if dist > 0 else 0
pm = int(pace_min_km)
ps = round((pace_min_km - pm) * 60)
if ps == 60:
    pm += 1
    ps = 0
pace_str = f"{pm}'{ps:02d}\""

print(f"Distance: {dist:.2f} km")
print(f"Duration: {dur_min} min")
print(f"Gain: {gain:.0f} m")
print(f"Max Alt: {max_alt:.0f} m")
print(f"Pace: {pace_str}")

import re

sample_gpx = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Zepp App" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <metadata>
    <time>2026-08-24T06:00:00Z</time>
    <extensions>
      <calories>245</calories>
    </extensions>
  </metadata>
  <trk>
    <name>문수산 러닝</name>
    <type>running</type>
    <trkseg>
      <trkpt lat="35.5384" lon="129.3114">
        <ele>120.5</ele>
        <time>2026-08-24T06:00:00Z</time>
        <extensions>
          <gpxtpx:TrackPointExtension>
            <gpxtpx:hr>142</gpxtpx:hr>
            <gpxtpx:cad>88</gpxtpx:cad>
          </gpxtpx:TrackPointExtension>
        </extensions>
      </trkpt>
      <trkpt lat="35.5390" lon="129.3120">
        <ele>125.0</ele>
        <time>2026-08-24T06:00:10Z</time>
        <extensions>
          <gpxtpx:TrackPointExtension>
            <gpxtpx:hr>158</gpxtpx:hr>
            <gpxtpx:cad>90</gpxtpx:cad>
          </gpxtpx:TrackPointExtension>
        </extensions>
      </trkpt>
    </trkseg>
  </trk>
</gpx>"""

# Test regex extraction
hr_vals = [int(m) for m in re.findall(r'<[^>]*:?hr[^>]*>(\d+)<', sample_gpx, re.I)]
cad_vals = [int(m) for m in re.findall(r'<[^>]*:?(?:cad|cadence)[^>]*>(\d+)<', sample_gpx, re.I)]
cal_match = re.search(r'<[^>]*:?(?:calories|total_calories|cal|kcal)[^>]*>(\d+)<', sample_gpx, re.I)

print('HRs:', hr_vals, 'Avg:', sum(hr_vals)//len(hr_vals), 'Max:', max(hr_vals))
avg_cad = sum(cad_vals)//len(cad_vals) if cad_vals else 0
if 40 < avg_cad < 120:
    avg_cad *= 2
print('Cads:', cad_vals, 'Avg SPM:', avg_cad)
print('Calories:', cal_match.group(1) if cal_match else None)

import sys
import json
import urllib.request

def main():
    try:
        raw_input = sys.stdin.read()
        ctx = json.loads(raw_input) if raw_input.strip() else {}
    except Exception:
        ctx = {}

    topic = "my-gravity-7788"
    title = "🚀 [Antigravity] 작업 완료!"
    msg = "요청하신 코딩/작업이 완료되었습니다. 안티그래비티 화면을 확인해주세요! 📱"
    tags = ["robot", "tada"]

    if ctx.get("error"):
        title = "⚠️ [Antigravity] 오류 발생"
        msg = f"작업 중 오류가 발생했습니다: {ctx.get('error')}"
        tags = ["warning"]

    payload = {
        "topic": topic,
        "title": title,
        "message": msg,
        "tags": tags
    }

    req = urllib.request.Request(
        "https://ntfy.sh",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            pass
    except Exception as e:
        sys.stderr.write(f"ntfy error: {e}\n")

    # Hook contract: return empty JSON object on stdout
    print(json.dumps({}))

if __name__ == "__main__":
    main()

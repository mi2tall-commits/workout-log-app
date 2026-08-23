import subprocess
import os

git_exe = r"C:\Users\user\AppData\Local\Programs\Git\cmd\git.exe"

def run(cmd):
    full_cmd = [git_exe] + cmd
    res = subprocess.run(full_cmd, capture_output=True, text=True, cwd=r"C:\Users\user\.gemini\antigravity\scratch\workout-log-app")
    print(f">> git {' '.join(cmd)}")
    if res.stdout:
        print(res.stdout.strip())
    if res.stderr:
        print(res.stderr.strip())

run(["init"])
run(["config", "user.name", "workout-user"])
run(["config", "user.email", "user@workout.local"])
run(["branch", "-M", "main"])
run(["add", "."])
run(["commit", "-m", "feat: initial commit for workout & tennis log apps with AGENTS.md"])
run(["status"])

import subprocess
import sys

git_exe = r"C:\Users\user\AppData\Local\Programs\Git\cmd\git.exe"
cwd = r"C:\Users\user\.gemini\antigravity\scratch\workout-log-app"

def run(cmd):
    full_cmd = [git_exe] + cmd
    print(f">> git {' '.join(cmd)}")
    res = subprocess.run(full_cmd, capture_output=True, text=True, cwd=cwd)
    if res.stdout:
        print(res.stdout.strip())
    if res.stderr:
        print(res.stderr.strip())
    return res.returncode

# Remove origin if exists
subprocess.run([git_exe, "remote", "remove", "origin"], cwd=cwd, capture_output=True)

# Add origin
run(["remote", "add", "origin", "https://github.com/mi2tall-commits/workout-log-app.git"])
run(["remote", "-v"])

# Push to main
ret = run(["push", "-u", "origin", "main"])
sys.exit(ret)

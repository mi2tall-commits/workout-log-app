import os
import urllib.request
import zipfile

dest_dir = r"C:\Users\user\AppData\Local\Programs\Git"
os.makedirs(dest_dir, exist_ok=True)

url = "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/MinGit-2.47.1-64-bit.zip"
zip_path = os.path.join(os.environ.get("TEMP", r"C:\Users\user\AppData\Local\Temp"), "MinGit.zip")

print("Downloading MinGit...")
opener = urllib.request.build_opener()
opener.addheaders = [('User-agent', 'Mozilla/5.0')]
urllib.request.install_opener(opener)

urllib.request.urlretrieve(url, zip_path)
print("Extracting MinGit...")
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(dest_dir)

if os.path.exists(zip_path):
    os.remove(zip_path)

git_cmd_dir = os.path.join(dest_dir, "cmd")
git_exe = os.path.join(git_cmd_dir, "git.exe")
print("Git setup completed! Testing:", git_exe)
os.system(f'"{git_exe}" --version')

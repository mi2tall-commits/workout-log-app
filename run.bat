@echo off
chcp 65001 > nul
echo ======================================================
echo    나의 운동일지 웹 애플리케이션 실행 중...
echo    접속 주소: http://localhost:8623
echo ======================================================
start http://localhost:8623
python "%~dp0app.py"
pause

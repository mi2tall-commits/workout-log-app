/**
 * Google Apps Script - 나의 테니스 일지 백엔드 (Code.gs)
 * 다중 사진 업로드 + 댓글 + ntfy 푸시 알림 + 스트링 교체 관리 + Gemini 3.6 Flash AI 스트링 교체 수명 진단
 */

// 🔔 스마트폰 ntfy 앱에서 설정하신 토픽 이름을 적어주세요!
var NTFY_TOPIC = "my-tennis-log-7788"; 

// 🔑 Google Gemini AI API Key (등록 완료)
var DEFAULT_GEMINI_API_KEY = "AQ.Ab8RN6I72Dj0lVu4k9TVb2j-24rQVj5I2VAvPovlf7CntVEXlA"; 

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle('🎾 나의 테니스 일지 | Tennis Log & String AI')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

// -------------------------------------------------------------
// [1. 시트 헬퍼 함수군]
// -------------------------------------------------------------
function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('테니스일지') || ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  
  if (sheet.getLastRow() === 0) {
    var headers = [
      "일자", "구분", "운동제목", "시간(분)", "강도(RPE)", 
      "경기결과", "스코어", "함께한사람", "코트종류", "장소", 
      "집중기술", "컨디션/메모", "사진ID목록", "댓글"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#16a34a').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getStringSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('스트링교체');
  if (!sheet) {
    sheet = ss.insertSheet('스트링교체');
  }
  if (sheet.getLastRow() === 0) {
    var headers = [
      "교체일자", "라켓모델", "스트링명", "스트링종류", "텐션(lbs)", 
      "교체비용", "스트링샵", "메모", "등록일시"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#16a34a').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function normalizeDateString(dateVal) {
  if (!dateVal) return "";
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    return Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  var str = String(dateVal).trim();
  var clean = str.replace(/[^\d]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  var parts = clean.split('-');
  if (parts.length >= 3) {
    var y = parts[0];
    var m = parts[1].length === 1 ? '0' + parts[1] : parts[1];
    var d = parts[2].length === 1 ? '0' + parts[2] : parts[2];
    return y + '-' + m + '-' + d;
  }
  return str;
}

function getOrCreatePhotoFolder() {
  var folderName = "테니스일지_사진";
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  var f = DriveApp.createFolder(folderName);
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return f;
}

// -------------------------------------------------------------
// [2. 테니스 일지 조회 & 통계]
// -------------------------------------------------------------
function getTennisData() {
  try {
    var sheet = getSheet();
    var data = sheet.getDataRange().getValues();
    if (!data || data.length <= 1) {
      return { logs: [], overview: getEmptyOverview(), monthly_trends: [] };
    }

    var logs = [];
    var totalHours = 0;
    var lessonCount = 0;
    var gameCount = 0;
    var practiceCount = 0;
    var wins = 0;
    var losses = 0;
    var monthlyMap = {};

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row || !row[0]) continue;

      var dateStr = normalizeDateString(row[0]);
      var category = String(row[1] || '레슨').trim();
      var title = String(row[2] || '').trim();
      var dur = Number(row[3]) || 0;
      var rpe = Number(row[4]) || 5;
      var result = String(row[5] || '').trim();
      var score = String(row[6] || '').trim();
      var players = String(row[7] || '').trim();
      var courtType = String(row[8] || '하드코트').trim();
      var location = String(row[9] || '').trim();
      var focusSkill = String(row[10] || '').trim();
      var notes = String(row[11] || '').trim();
      var photoIdsStr = String(row[12] || '').trim();
      var commentsRaw = row[13] || '';

      totalHours += dur / 60;

      if (category === '레슨') lessonCount++;
      else if (category === '클럽게임' || category === '게임') {
        gameCount++;
        if (result === '승' || result === '승리') wins++;
        else if (result === '패' || result === '패배') losses++;
      } else if (category === '랠리/연습' || category === '연습') {
        practiceCount++;
      }

      // 월별 집계
      var monthStr = dateStr.length >= 7 ? dateStr.substring(0, 7) : "기타";
      if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { "레슨": 0, "클럽게임": 0, "랠리/연습": 0, "승": 0, "패": 0 };
      monthlyMap[monthStr][category] = (monthlyMap[monthStr][category] || 0) + 1;
      if (result === '승' || result === '승리') monthlyMap[monthStr]["승"]++;
      if (result === '패' || result === '패배') monthlyMap[monthStr]["패"]++;

      var photoIds = [];
      if (photoIdsStr) {
        photoIds = photoIdsStr.split(',').map(function(id) { return id.trim(); }).filter(Boolean);
      }

      var comments = [];
      if (commentsRaw) {
        try {
          comments = typeof commentsRaw === 'string' ? JSON.parse(commentsRaw) : commentsRaw;
          if (!Array.isArray(comments)) comments = [];
        } catch(e) {
          comments = [];
        }
      }

      logs.push({
        rowIndex: i + 1,
        date: dateStr,
        category: category,
        title: title,
        duration_minutes: dur,
        intensity: rpe,
        result: result,
        score: score,
        players: players,
        court_type: courtType,
        location: location,
        focus_skill: focusSkill,
        notes: notes,
        photo_ids: photoIds,
        comments: comments
      });
    }

    logs.sort(function(a, b) {
      var dateCompare = (b.date || "").localeCompare(a.date || "");
      if (dateCompare !== 0) return dateCompare;
      return (b.rowIndex || 0) - (a.rowIndex || 0);
    });

    var totalGames = wins + losses;
    var winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

    var months = Object.keys(monthlyMap).sort();
    var monthlyTrends = [];
    months.forEach(function(m) {
      monthlyTrends.push({ month: m, data: monthlyMap[m] });
    });

    return {
      logs: logs,
      overview: {
        total_activities: logs.length,
        lesson_count: lessonCount,
        game_count: gameCount,
        practice_count: practiceCount,
        wins: wins,
        losses: losses,
        win_rate: winRate,
        total_hours: Math.round(totalHours * 10) / 10
      },
      monthly_trends: monthlyTrends
    };
  } catch (e) {
    Logger.log("getTennisData error: " + e.message);
    return { logs: [], overview: getEmptyOverview(), monthly_trends: [], error: e.message };
  }
}

// -------------------------------------------------------------
// [3. 테니스 일지 CRUD]
// -------------------------------------------------------------
function saveTennisLog(item) {
  try {
    var sheet = getSheet();
    var dateStr = item.date;
    var category = item.category || '레슨';
    var title = item.title || (category === '레슨' ? (item.focus_skill ? item.focus_skill + ' 레슨' : '테니스 레슨') : '클럽 게임');
    var dur = item.duration_minutes || 0;
    var rpe = item.intensity || 5;
    var result = item.result || '';
    var score = item.score || '';
    var players = item.players || '';
    var courtType = item.court_type || '하드코트';
    var loc = item.location || '';
    var focusSkill = item.focus_skill || '';
    var notes = item.notes || '';
    var photoIds = [];

    if (item.photos && item.photos.length > 0) {
      try {
        var folder = getOrCreatePhotoFolder();
        for (var p = 0; p < item.photos.length; p++) {
          var base64Data = item.photos[p];
          if (base64Data && base64Data.indexOf('data:') === 0) {
            var parts = base64Data.split(',');
            var contentType = parts[0].split(';')[0].replace('data:', '');
            var bytes = Utilities.base64Decode(parts[1]);
            var fileName = 'tennis_' + dateStr + '_' + (p + 1) + '_' + (new Date().getTime()) + '.jpg';
            var blob = Utilities.newBlob(bytes, contentType, fileName);
            var file = folder.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            photoIds.push(file.getId());
          }
        }
      } catch(e) {
        Logger.log('Tennis photo upload error: ' + e.message);
      }
    }

    var photoIdsStr = photoIds.join(',');

    sheet.appendRow([
      dateStr, category, title, dur, rpe,
      result, score, players, courtType, loc,
      focusSkill, notes, photoIdsStr, "[]"
    ]);

    sendNtfyTennisNotification(item);
    return { success: true };
  } catch (e) {
    Logger.log("saveTennisLog error: " + e.message);
    throw new Error("저장 실패: " + e.message);
  }
}

function updateTennisLog(item) {
  try {
    var rowIndex = item.rowIndex;
    if (!rowIndex || rowIndex < 2) throw new Error("유효하지 않은 일지 번호입니다.");
    var sheet = getSheet();
    var dateStr = item.date;
    var category = item.category || '레슨';
    var title = item.title || (category === '레슨' ? (item.focus_skill ? item.focus_skill + ' 레슨' : '테니스 레슨') : '클럽 게임');
    var dur = item.duration_minutes || 0;
    var rpe = item.intensity || 5;
    var result = item.result || '';
    var score = item.score || '';
    var players = item.players || '';
    var courtType = item.court_type || '하드코트';
    var loc = item.location || '';
    var focusSkill = item.focus_skill || '';
    var notes = item.notes || '';
    var photoIds = item.existingPhotoIds || [];

    if (item.photos && item.photos.length > 0) {
      try {
        var folder = getOrCreatePhotoFolder();
        for (var p = 0; p < item.photos.length; p++) {
          var base64Data = item.photos[p];
          if (base64Data && base64Data.indexOf('data:') === 0) {
            var parts = base64Data.split(',');
            var contentType = parts[0].split(';')[0].replace('data:', '');
            var bytes = Utilities.base64Decode(parts[1]);
            var fileName = 'tennis_' + dateStr + '_' + (p + 1) + '_' + (new Date().getTime()) + '.jpg';
            var blob = Utilities.newBlob(bytes, contentType, fileName);
            var file = folder.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            photoIds.push(file.getId());
          }
        }
      } catch(e) {
        Logger.log('Tennis photo upload error: ' + e.message);
      }
    }

    var photoIdsStr = photoIds.join(',');

    sheet.getRange(rowIndex, 1, 1, 13).setValues([[
      dateStr, category, title, dur, rpe,
      result, score, players, courtType, loc,
      focusSkill, notes, photoIdsStr
    ]]);

    return { success: true };
  } catch (e) {
    Logger.log("updateTennisLog error: " + e.message);
    throw new Error("수정 실패: " + e.message);
  }
}

function deleteTennisLog(rowIndex) {
  try {
    if (!rowIndex || rowIndex < 2) throw new Error("유효하지 않은 일지 번호입니다.");
    var sheet = getSheet();
    sheet.deleteRow(rowIndex);
    return { success: true };
  } catch (e) {
    Logger.log("deleteTennisLog error: " + e.message);
    throw new Error("삭제 실패: " + e.message);
  }
}

// -------------------------------------------------------------
// [4. 댓글 관리 API]
// -------------------------------------------------------------
function addTennisComment(rowIndex, commentData) {
  try {
    if (!rowIndex || rowIndex < 2) throw new Error("유효하지 않은 일지 번호입니다.");
    var sheet = getSheet();
    var cell = sheet.getRange(rowIndex, 14);
    var rawVal = cell.getValue();
    var comments = [];
    if (rawVal) {
      try {
        comments = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal;
        if (!Array.isArray(comments)) comments = [];
      } catch(e) { comments = []; }
    }

    var newComment = {
      id: Utilities.getUuid(),
      author: String(commentData.author || '작성자').trim(),
      text: String(commentData.text || '').trim(),
      createdAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm")
    };
    if (!newComment.text) throw new Error("댓글 내용을 입력해주세요.");

    comments.push(newComment);
    cell.setValue(JSON.stringify(comments));

    var rowData = sheet.getRange(rowIndex, 1, 1, 3).getValues()[0];
    var logDate = normalizeDateString(rowData[0]);
    var logTitle = rowData[2] || rowData[1] || '테니스 일지';
    sendNtfyTennisCommentNotification(logDate, logTitle, newComment);

    return { success: true, comments: comments };
  } catch(e) {
    Logger.log("addTennisComment error: " + e.message);
    throw new Error("댓글 등록 실패: " + e.message);
  }
}

function updateTennisComment(rowIndex, commentId, newText) {
  try {
    if (!rowIndex || rowIndex < 2 || !commentId) throw new Error("유효하지 않은 댓글 정보입니다.");
    var sheet = getSheet();
    var cell = sheet.getRange(rowIndex, 14);
    var rawVal = cell.getValue();
    var comments = [];
    if (rawVal) {
      try {
        comments = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal;
        if (!Array.isArray(comments)) comments = [];
      } catch(e) { comments = []; }
    }

    var updated = false;
    for (var i = 0; i < comments.length; i++) {
      if (comments[i].id === commentId) {
        comments[i].text = String(newText || '').trim();
        comments[i].updatedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
        updated = true;
        break;
      }
    }

    if (!updated) throw new Error("수정할 댓글을 찾을 수 없습니다.");
    cell.setValue(JSON.stringify(comments));
    return { success: true, comments: comments };
  } catch(e) {
    Logger.log("updateTennisComment error: " + e.message);
    throw new Error("댓글 수정 실패: " + e.message);
  }
}

function deleteTennisComment(rowIndex, commentId) {
  try {
    if (!rowIndex || rowIndex < 2 || !commentId) throw new Error("유효하지 않은 댓글 정보입니다.");
    var sheet = getSheet();
    var cell = sheet.getRange(rowIndex, 14);
    var rawVal = cell.getValue();
    var comments = [];
    if (rawVal) {
      try {
        comments = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal;
        if (!Array.isArray(comments)) comments = [];
      } catch(e) { comments = []; }
    }

    comments = comments.filter(function(c) { return c.id !== commentId; });
    cell.setValue(JSON.stringify(comments));
    return { success: true, comments: comments };
  } catch(e) {
    Logger.log("deleteTennisComment error: " + e.message);
    throw new Error("댓글 삭제 실패: " + e.message);
  }
}

// -------------------------------------------------------------
// [5. 🎾 스트링 교체 관리 & 데이터 분석]
// -------------------------------------------------------------
function getTennisStringData() {
  try {
    var stringSheet = getStringSheet();
    var sData = stringSheet.getDataRange().getValues();
    var stringLogs = [];

    if (sData && sData.length > 1) {
      for (var i = 1; i < sData.length; i++) {
        var r = sData[i];
        if (!r || !r[0]) continue;
        var dateStr = normalizeDateString(r[0]);
        stringLogs.push({
          rowIndex: i + 1,
          date: dateStr,
          racket: String(r[1] || '기본 라켓').trim(),
          string_name: String(r[2] || '미지정').trim(),
          string_type: String(r[3] || '폴리').trim(),
          tension: String(r[4] || '50').trim(),
          cost: Number(r[5]) || 0,
          shop_name: String(r[6] || '').trim(),
          notes: String(r[7] || '').trim(),
          createdAt: r[8] ? String(r[8]) : ''
        });
      }
    }

    // 날짜 내림차순 정렬
    stringLogs.sort(function(a, b) {
      var dComp = (b.date || '').localeCompare(a.date || '');
      if (dComp !== 0) return dComp;
      return (b.rowIndex || 0) - (a.rowIndex || 0);
    });

    var activeString = stringLogs.length > 0 ? stringLogs[0] : null;
    var statsSince = {
      daysElapsed: 0,
      totalHours: 0,
      totalMinutes: 0,
      sessionCount: 0,
      gameCount: 0,
      lessonCount: 0,
      practiceCount: 0,
      avgIntensity: 0,
      hardSessions: 0,
      courtTypes: {},
      logsSince: []
    };

    if (activeString && activeString.date) {
      var tennisSheet = getSheet();
      var tData = tennisSheet.getDataRange().getValues();
      var activeDate = activeString.date;
      var sumIntensity = 0;

      var tNow = new Date();
      var tStrung = new Date(activeDate);
      if (!isNaN(tStrung.getTime())) {
        var diffTime = Math.abs(tNow - tStrung);
        statsSince.daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      if (tData && tData.length > 1) {
        for (var j = 1; j < tData.length; j++) {
          var row = tData[j];
          if (!row || !row[0]) continue;
          var logDate = normalizeDateString(row[0]);
          if (logDate >= activeDate) {
            var dur = Number(row[3]) || 0;
            var rpe = Number(row[4]) || 5;
            var cat = String(row[1] || '레슨').trim();
            var cType = String(row[8] || '하드코트').trim();
            var nts = String(row[11] || '').trim();

            statsSince.sessionCount++;
            statsSince.totalMinutes += dur;
            sumIntensity += rpe;
            if (rpe >= 7) statsSince.hardSessions++;

            if (cat === '레슨') statsSince.lessonCount++;
            else if (cat === '클럽게임' || cat === '게임') statsSince.gameCount++;
            else statsSince.practiceCount++;

            statsSince.courtTypes[cType] = (statsSince.courtTypes[cType] || 0) + 1;
            statsSince.logsSince.push({
              date: logDate,
              category: cat,
              duration: dur,
              intensity: rpe,
              notes: nts
            });
          }
        }
      }

      statsSince.totalHours = Math.round((statsSince.totalMinutes / 60) * 10) / 10;
      statsSince.avgIntensity = statsSince.sessionCount > 0 ? Math.round((sumIntensity / statsSince.sessionCount) * 10) / 10 : 0;
    }

    return {
      stringLogs: stringLogs,
      activeString: activeString,
      statsSince: statsSince
    };
  } catch(e) {
    Logger.log("getTennisStringData error: " + e.message);
    throw new Error("스트링 데이터 조회 실패: " + e.message);
  }
}

function saveStringRecord(item) {
  try {
    var sheet = getStringSheet();
    var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
    sheet.appendRow([
      item.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      item.racket || '기본 라켓',
      item.string_name || '미지정',
      item.string_type || '폴리',
      item.tension || '50',
      Number(item.cost) || 0,
      item.shop_name || '',
      item.notes || '',
      nowStr
    ]);

    try {
      sendNtfyMessage(NTFY_TOPIC, "🎾 [스트링 교체 등록]", (item.date || '') + " " + (item.racket || '') + "에 " + (item.string_name || '') + " (" + (item.tension || '') + " lbs) 새 스트링 장착!", ["tennis", "wrench"]);
    } catch(err) {}

    return { success: true };
  } catch(e) {
    Logger.log("saveStringRecord error: " + e.message);
    throw new Error("스트링 기록 저장 실패: " + e.message);
  }
}

function deleteStringRecord(rowIndex) {
  try {
    var sheet = getStringSheet();
    var idx = parseInt(rowIndex);
    if (!idx || idx < 2) throw new Error("유효하지 않은 행입니다.");
    sheet.deleteRow(idx);
    return { success: true };
  } catch(e) {
    Logger.log("deleteStringRecord error: " + e.message);
    throw new Error("스트링 기록 삭제 실패: " + e.message);
  }
}

// -------------------------------------------------------------
// [6. 🤖 GEMINI AI 스트링 교체 수명 진단 & 일지 코칭 요약]
// -------------------------------------------------------------
function analyzeTennisStringAI(item) {
  try {
    var apiKey = item.geminiApiKey || DEFAULT_GEMINI_API_KEY;
    var stringInfo = item.activeString;
    var stats = item.statsSince;

    if (!stringInfo) {
      return {
        success: false,
        analysis: "등록된 스트링 교체 이력이 없습니다. 먼저 '➕ 새 스트링 교체 등록' 버튼을 눌러 현재 라켓의 스트링 교체일을 등록해주세요! 🎾"
      };
    }

    var prompt = "너는 세계적인 프로 테니스 스트링 기술자이자 동호인 맞춤 스포츠 의학/장비 전문 수석 테니스 코치야.\n" +
      "사용자(여성 테니스 동호인)가 입력한 라켓/스트링 사양과 스트링 장착 이후 기록된 '테니스 일지(플레이 시간, 강도, 게임 수, 일지 메모/후기)'를 종합 분석하여, **【지금 스트링을 교체해야 하는지 여부】**를 명확하고 친절하게 판정하고 조언해줘.\n\n" +
      "【장착 스트링 사양】\n" +
      "- 교체 일자: " + stringInfo.date + " (현재 " + stats.daysElapsed + "일 경과)\n" +
      "- 라켓 모델: " + stringInfo.racket + "\n" +
      "- 스트링 모델: " + stringInfo.string_name + " (" + stringInfo.string_type + " 스트링)\n" +
      "- 세팅 텐션: " + stringInfo.tension + " lbs\n" +
      "- 특이사항: " + (stringInfo.notes || '없음') + "\n\n" +
      "【교체 이후 누적 테니스 일지 데이터】\n" +
      "- 누적 코트 사용 시간: " + stats.totalHours + "시간 (" + stats.totalMinutes + "분)\n" +
      "- 총 세션 수: " + stats.sessionCount + "회 (클럽게임 " + stats.gameCount + "회, 레슨 " + stats.lessonCount + "회, 연습 " + stats.practiceCount + "회)\n" +
      "- 평균 운동 강도: RPE " + stats.avgIntensity + "/10 (고강도 RPE 7+ 경기: " + stats.hardSessions + "회)\n" +
      "- 최근 테니스 일지 메모/후기 기록: " + JSON.stringify(stats.logsSince.slice(-15).map(function(l){ return l.date + ' [' + l.category + ']: ' + (l.notes || '특이사항 없음'); })) + "\n\n" +
      "【분석 지침 및 필수 구성】\n" +
      "아래 5가지 섹션으로 나누어 명확하게 작성할 것:\n" +
      "1. 🚦 [스트링 교체 최종 판정: 🔴즉시 교체 권장 / 🟡조만간 교체 권장 / 🟢현재 상태 양호 중 택 1]\n" +
      "   - 지금 당장 스트링을 새로 매야 하는지, 아니면 얼마간 더 사용 가능한지 결론을 맨 첫 줄에 명확히 선언할 것.\n" +
      "2. 🎾 [스트링 건강도 & 잔여 수명 점수 (0~100%)]\n" +
      "   - 여성 동호인 기준 권장 수명(40~50시간 / 2~3개월) 대비 현재 잔여 수명 점수와 사용 시간 비율 제시.\n" +
      "3. 📝 [테니스 일지 기반 타구감 & 피드백 분석]\n" +
      "   - 사용자가 일지에 남긴 메모(컨디션, 타구감, 공 날림, 빗맞음 등)를 직접 인용 및 연계하여 스트링 탄성 저하와의 상관관계를 분석할 것.\n" +
      "4. ⚠️ [관절(엘보/손목) 부상 예방 & 타구 충격 진단]\n" +
      "   - 텐션 로스 및 탄성 소실로 인해 팔과 손목에 전달되는 진동 충격 위험도 평가.\n" +
      "5. 💡 [맞춤 스트링 추천 & 최적 텐션 세팅 팁]\n" +
      "   - 다음 교체 시기(앞으로 N시간/N주 이내)와 여성 동호인에게 추천하는 부드러운 스트링 및 텐션(lbs) 가이드 제시.";

    var modelsToTry = ["gemini-3-flash-preview", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest"];
    var lastError = "";

    for (var i = 0; i < modelsToTry.length; i++) {
      var modelName = modelsToTry[i];
      var url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelName + ":generateContent?key=" + apiKey;
      
      var payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
      };

      var options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      var response = UrlFetchApp.fetch(url, options);
      var resCode = response.getResponseCode();
      var resText = response.getContentText();

      if (resCode === 200) {
        var json = JSON.parse(resText);
        if (json.candidates && json.candidates.length > 0 && json.candidates[0].content && json.candidates[0].content.parts.length > 0) {
          var parts = json.candidates[0].content.parts;
          var fullText = "";
          for (var p = 0; p < parts.length; p++) {
            if (!parts[p].thought && parts[p].text) fullText += parts[p].text;
          }
          if (!fullText.trim()) fullText = parts[parts.length - 1].text || "";
          if (fullText.trim()) {
            return {
              success: true,
              analysis: fullText.trim(),
              isAi: true
            };
          }
        }
      } else {
        lastError = "Model " + modelName + " Error (" + resCode + "): " + resText;
      }
    }

    return {
      success: false,
      error: lastError,
      analysis: "[🎾 스트링 진단 가이드]\n누적 플레이 " + stats.totalHours + "시간 / 경과 " + stats.daysElapsed + "일차입니다. 통상적인 폴리 스트링 교체 주기(15~20시간)를 감안하여 점검하시길 권장합니다."
    };
  } catch(e) {
    Logger.log("analyzeTennisStringAI error: " + e.message);
    return {
      success: false,
      error: e.message,
      analysis: "스트링 분석 중 오류 발생: " + e.message
    };
  }
}

function generateGeminiTennisSummary(item) {
  try {
    var apiKey = item.geminiApiKey || DEFAULT_GEMINI_API_KEY;
    var cat = item.category || '테니스';
    var dur = item.duration_minutes || 0;
    var rpe = item.intensity || 5;
    var score = item.score || '';
    var result = item.result || '';
    var skill = item.focus_skill || '';
    var loc = item.location || '';
    var court = item.court_type || '';

    var prompt = "너는 엘리트 테니스 프로 코치야.\n" +
      "사용자가 작성한 다음 테니스 세션 데이터를 바탕으로, 일지 '메모/후기'란에 바로 넣을 수 있는 칭찬과 전문 피드백이 담긴 코칭 요약글을 작성해줘.\n\n" +
      "- 활동 구분: " + cat + "\n" +
      "- 시간: " + dur + "분 (강도 RPE " + rpe + "/10)\n" +
      (score ? "- 경기 결과: " + result + " (" + score + ")\n" : "") +
      (skill ? "- 집중 훈련 기술: " + skill + "\n" : "") +
      (loc ? "- 장소/코트: " + loc + " (" + court + ")\n" : "") +
      "\n" +
      "규칙: 3문장 내외로 [🎾 오늘의 핵심 코칭 포인트]와 [💡 다음 세션 추천 팁] 2개 소제목으로 활기차게 작성할 것.";

    var modelsToTry = ["gemini-3-flash-preview", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest"];
    for (var i = 0; i < modelsToTry.length; i++) {
      var modelName = modelsToTry[i];
      var url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelName + ":generateContent?key=" + apiKey;
      var payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
      };
      var options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };
      var response = UrlFetchApp.fetch(url, options);
      if (response.getResponseCode() === 200) {
        var json = JSON.parse(response.getContentText());
        if (json.candidates && json.candidates.length > 0 && json.candidates[0].content && json.candidates[0].content.parts.length > 0) {
          var parts = json.candidates[0].content.parts;
          var txt = "";
          for (var p = 0; p < parts.length; p++) {
            if (!parts[p].thought && parts[p].text) txt += parts[p].text;
          }
          if (!txt.trim()) txt = parts[parts.length - 1].text || "";
          if (txt.trim()) {
            return { success: true, summary: txt.trim(), isAi: true };
          }
        }
      }
    }

    return {
      success: true,
      summary: "[🎾 오늘의 핵심 코칭 포인트]\n" + cat + " " + dur + "분 동안 강도 RPE " + rpe + "로 훌륭하게 세션을 마쳤습니다!\n\n[💡 다음 세션 추천 팁]\n타구 시 팔로우스루와 풋워크 밸런스를 계속 유지해보세요! 🔥"
    };
  } catch(e) {
    return {
      success: false,
      summary: "[🎾 코치 메모]\n오늘도 멋진 테니스 훈련을 완료하셨습니다! 수고하셨습니다. 🔥"
    };
  }
}

// -------------------------------------------------------------
// [7. 기타 유틸리티 & ntfy 알림]
// -------------------------------------------------------------
function sendNtfyMessage(topic, title, message, tags) {
  if (!topic) return;
  try {
    var payload = {
      topic: topic,
      title: title,
      message: message,
      tags: tags || ["tennis"]
    };
    var options = {
      method: "post",
      contentType: "application/json; charset=utf-8",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    UrlFetchApp.fetch("https://ntfy.sh", options);
  } catch(e) {
    Logger.log("ntfy 푸시 전송 실패: " + e.message);
  }
}

function sendNtfyTennisNotification(item) {
  var details = [];
  details.push("⏱️ " + item.duration_minutes + "분 (RPE " + item.intensity + ")");
  if (item.location) details.push("🏟️ " + item.location);
  if (item.court_type) details.push("(" + item.court_type + ")");
  if (item.category === '클럽게임' && item.score) details.push("🎾 " + (item.result || '') + " (" + item.score + ")");
  if (item.focus_skill) details.push("🎯 " + item.focus_skill);
  if (item.notes) details.push("\n💬 " + item.notes);

  var message = details.join(" | ");
  var title = "🎾 [테니스 " + item.category + "] " + (item.title || '테니스 활동');
  sendNtfyMessage(NTFY_TOPIC, title, message, ["tennis", "trophy"]);
}

function sendNtfyTennisCommentNotification(logDate, logTitle, comment) {
  var title = "💬 [테니스 일지 새 피드백 - " + comment.author + "님]";
  var message = "📌 " + logDate + " " + logTitle + "\n\n\"" + comment.text + "\"";
  sendNtfyMessage(NTFY_TOPIC, title, message, ["speech_balloon"]);
}

function getEmptyOverview() {
  return {
    total_activities: 0,
    lesson_count: 0,
    game_count: 0,
    practice_count: 0,
    wins: 0,
    losses: 0,
    win_rate: 0,
    total_hours: 0
  };
}

function testTennisNtfyAlert() {
  var title = "🎾 [테니스일지 알림 테스트] 성공!";
  var message = "스마트폰으로 테니스 일지 알림이 정상적으로 수신됩니다! 🏆";
  sendNtfyMessage(NTFY_TOPIC, title, message, ["tennis", "tada"]);
  Logger.log("테니스일지 테스트 알림 발송 완료!");
}

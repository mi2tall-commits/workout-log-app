/**
 * Google Apps Script - 나의 테니스 일지 백엔드 (Code.gs)
 * 다중 사진 업로드 + N열 댓글(작성/수정/삭제) + ntfy 푸시 알림 + 수정/삭제 지원 + 당일 최신순 정렬
 */

// 🔔 스마트폰 ntfy 앱에서 설정하신 토픽 이름을 적어주세요! (테니스 일지 전용 토픽)
var NTFY_TOPIC = "my-tennis-log-7788"; 

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle('🎾 나의 테니스 일지 | Tennis Log')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('테니스일지') || ss.getSheets()[0];
  
  if (sheet.getLastRow() > 0 && sheet.getLastColumn() >= 13) {
    var headerN = sheet.getRange(1, 14).getValue();
    if (!headerN) {
      sheet.getRange(1, 14).setValue('댓글');
    }
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

// 최초 1회 구글 드라이브 권한 승인용 테스트 함수
function testDriveAuth() {
  var folder = getOrCreatePhotoFolder();
  Logger.log("구글 드라이브 권한 승인 완료! 폴더명: " + folder.getName());
  return "구글 드라이브 권한 승인 완료!";
}

// 사진 저장용 구글 드라이브 폴더 가져오기 또는 생성
function getOrCreatePhotoFolder() {
  var folderName = "테니스일지_사진";
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

// 1. 전체 테니스 기록 & 전적/통계 + 댓글 조회 (당일 최신순 정렬)
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

      // 다중 사진 ID 배열 파싱
      var photoIds = [];
      if (photoIdsStr) {
        photoIds = photoIdsStr.split(',').map(function(id) { return id.trim(); }).filter(Boolean);
      }

      // 댓글 배열 파싱
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

    // 🌟 1순위: 날짜 내림차순, 2순위(동일 날짜): 최근 입력한 행(높은 rowIndex)이 맨 위에 오도록 정렬
    logs.sort(function(a, b) {
      var dateCompare = (b.date || "").localeCompare(a.date || "");
      if (dateCompare !== 0) {
        return dateCompare;
      }
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
    return {
      logs: [],
      overview: getEmptyOverview(),
      monthly_trends: [],
      error: e.message
    };
  }
}

// 2. 새 테니스 기록 저장
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

// 3. ✏️ 테니스 일지 수정 API
function updateTennisLog(item) {
  try {
    var rowIndex = item.rowIndex;
    if (!rowIndex || rowIndex < 2) {
      throw new Error("유효하지 않은 일지 번호입니다.");
    }
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

    // A열 ~ M열(13개 셀) 수정 (N열 댓글은 보존)
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

// 4. 🗑️ 테니스 일지 삭제 API
function deleteTennisLog(rowIndex) {
  try {
    if (!rowIndex || rowIndex < 2) {
      throw new Error("유효하지 않은 일지 번호입니다.");
    }
    var sheet = getSheet();
    sheet.deleteRow(rowIndex);
    return { success: true };
  } catch (e) {
    Logger.log("deleteTennisLog error: " + e.message);
    throw new Error("삭제 실패: " + e.message);
  }
}

// 5. 💬 댓글 추가 API
function addTennisComment(rowIndex, commentData) {
  try {
    if (!rowIndex || rowIndex < 2) {
      throw new Error("유효하지 않은 일지 번호입니다.");
    }
    var sheet = getSheet();
    var cell = sheet.getRange(rowIndex, 14);
    var rawVal = cell.getValue();
    
    var comments = [];
    if (rawVal) {
      try {
        comments = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal;
        if (!Array.isArray(comments)) comments = [];
      } catch(e) {
        comments = [];
      }
    }

    var newComment = {
      id: Utilities.getUuid(),
      author: String(commentData.author || '작성자').trim(),
      text: String(commentData.text || '').trim(),
      createdAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm")
    };

    if (!newComment.text) {
      throw new Error("댓글 내용을 입력해주세요.");
    }

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

// 6. 💬 댓글 수정 API
function updateTennisComment(rowIndex, commentId, newText) {
  try {
    if (!rowIndex || rowIndex < 2 || !commentId) {
      throw new Error("유효하지 않은 댓글 정보입니다.");
    }
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

// 7. 💬 댓글 삭제 API
function deleteTennisComment(rowIndex, commentId) {
  try {
    if (!rowIndex || rowIndex < 2 || !commentId) {
      throw new Error("유효하지 않은 댓글 정보입니다.");
    }
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

// 🔔 ntfy 발송 함수
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

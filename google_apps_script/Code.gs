/**
 * 종합 운동일지 백엔드 (Code.gs)
 * 다중 사진 업로드 + Q열 댓글(작성/수정/삭제) + ntfy 푸시 알림 + 수정/삭제 지원 + 당일 최신순 정렬
 */

// 🔔 스마트폰 ntfy 앱에서 설정하신 토픽 이름을 적어주세요!
var NTFY_TOPIC = "my-workout-log-7788"; 

// 🟧 Strava API 설정 (https://www.strava.com/settings/api 에서 확인)
var STRAVA_CLIENT_ID = "";
var STRAVA_CLIENT_SECRET = "";
var STRAVA_REFRESH_TOKEN = ""; 

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle('나의 운동일지 | Workout Log')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('운동일지') || ss.getSheets()[0];
  
  if (sheet.getLastRow() > 0 && sheet.getLastColumn() >= 16) {
    var headerQ = sheet.getRange(1, 17).getValue();
    if (!headerQ) {
      sheet.getRange(1, 17).setValue('댓글');
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

// 1. 전체 운동 데이터 및 대시보드 통계 + 댓글 조회 (당일 최신순 정렬)
function getWorkoutData() {
  try {
    var sheet = getSheet();
    var data = sheet.getDataRange().getValues();
    if (!data || data.length <= 1) {
      return { logs: [], overview: getEmptyOverview(), monthly_trends: [] };
    }

    var logs = [];
    var totalHours = 0;
    var runningKm = 0;
    var hikingElevation = 0;
    var freediveDepth = 0;
    var sportCounts = {};
    var monthlyMap = {};

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row || !row[0]) continue;

      var dateStr = normalizeDateString(row[0]);
      var sport = String(row[1] || '기타').trim();
      var title = String(row[2] || '').trim();
      var dur = Number(row[3]) || 0;
      var rpe = Number(row[4]) || 5;
      var dist = Number(row[5]) || 0;
      var pace = String(row[6] || '').trim();
      var elev = Number(row[7]) || 0;
      var maxAlt = Number(row[8]) || 0;
      var depth = Number(row[9]) || 0;
      var disc = String(row[10] || '').trim();
      var loc = String(row[11] || '').trim();
      var weather = String(row[12] || '맑음').trim();
      var gear = String(row[13] || '').trim();
      var notes = String(row[14] || '').trim();
      var photoIdsStr = String(row[15] || '').trim();
      var commentsRaw = row[16] || '';

      if (!title) {
        if (loc) {
          title = loc + ' ' + sport;
        } else if (notes) {
          var firstLine = notes.split('\n')[0].trim();
          title = firstLine.length > 25 ? firstLine.substring(0, 25) + '...' : firstLine;
        } else {
          title = sport + ' 활동';
        }
      }

      totalHours += dur / 60;
      if (sport === '런닝') runningKm += dist;
      if (sport === '등산' || sport === '트레일런닝') hikingElevation += elev;
      if (sport === '프리다이빙' && depth > freediveDepth) freediveDepth = depth;

      sportCounts[sport] = (sportCounts[sport] || 0) + 1;

      var monthStr = dateStr.length >= 7 ? dateStr.substring(0, 7) : "기타";
      if (!monthlyMap[monthStr]) monthlyMap[monthStr] = {};
      monthlyMap[monthStr][sport] = (monthlyMap[monthStr][sport] || 0) + 1;

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
        sport: sport,
        title: title,
        duration_minutes: dur,
        intensity: rpe,
        distance_km: dist,
        pace: pace,
        elevation_gain: elev,
        max_altitude: maxAlt,
        freedive_depth: depth,
        discipline: disc,
        location_course: loc,
        weather: weather,
        gear: gear,
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

    var months = Object.keys(monthlyMap).sort();
    var monthlyTrends = [];
    months.forEach(function(m) {
      monthlyTrends.push({
        month: m,
        counts: monthlyMap[m]
      });
    });

    return {
      logs: logs,
      overview: {
        total_workouts: logs.length,
        total_duration_hours: Math.round(totalHours * 10) / 10,
        running_total_km: Math.round(runningKm * 10) / 10,
        total_elevation_gain: hikingElevation,
        freedive_max_depth: freediveDepth,
        sport_counts: sportCounts
      },
      monthly_trends: monthlyTrends
    };
  } catch (e) {
    Logger.log("getWorkoutData error: " + e.message);
    return { logs: [], overview: getEmptyOverview(), monthly_trends: [], error: e.message };
  }
}

// 2. 새 운동 기록 저장
function saveWorkout(item) {
  try {
    var sheet = getSheet();
    var dateStr = item.date;
    var sport = item.sport;
    var title = item.title || (sport + ' 운동');
    var dur = item.duration_minutes || 0;
    var rpe = item.intensity || 5;
    var dist = item.distance_km || '';
    var pace = item.pace || '';
    var elev = item.elevation_gain || '';
    var maxAlt = item.max_altitude || '';
    var depth = item.freedive_depth || '';
    var disc = item.discipline || '';
    var loc = item.location_course || '';
    var weather = item.weather || '맑음';
    var gear = item.gear || '';
    var notes = item.notes || '';
    var photoIds = [];

    if (item.photos && item.photos.length > 0) {
      try {
        var folderName = "운동일지_사진";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
        
        for (var p = 0; p < item.photos.length; p++) {
          var base64Data = item.photos[p];
          if (base64Data && base64Data.indexOf('data:') === 0) {
            var parts = base64Data.split(',');
            var contentType = parts[0].split(';')[0].replace('data:', '');
            var bytes = Utilities.base64Decode(parts[1]);
            var fileName = 'workout_' + dateStr + '_' + (p + 1) + '_' + (new Date().getTime()) + '.jpg';
            var blob = Utilities.newBlob(bytes, contentType, fileName);
            var file = folder.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            photoIds.push(file.getId());
          }
        }
      } catch(e) {
        Logger.log('Photo upload error: ' + e.message);
      }
    }

    var photoIdsStr = photoIds.join(',');

    sheet.appendRow([
      dateStr, sport, title, dur, rpe,
      dist, pace, elev, maxAlt, depth,
      disc, loc, weather, gear, notes,
      photoIdsStr, "[]"
    ]);

    sendNtfyWorkoutNotification(item);

    return { success: true };
  } catch (e) {
    Logger.log("saveWorkout error: " + e.message);
    throw new Error("저장 실패: " + e.message);
  }
}

// 3. ✏️ 운동 일지 수정 API
function updateWorkout(item) {
  try {
    var rowIndex = item.rowIndex;
    if (!rowIndex || rowIndex < 2) {
      throw new Error("유효하지 않은 일지 번호입니다.");
    }
    var sheet = getSheet();
    var dateStr = item.date;
    var sport = item.sport;
    var title = item.title || (sport + ' 운동');
    var dur = item.duration_minutes || 0;
    var rpe = item.intensity || 5;
    var dist = item.distance_km || '';
    var pace = item.pace || '';
    var elev = item.elevation_gain || '';
    var maxAlt = item.max_altitude || '';
    var depth = item.freedive_depth || '';
    var disc = item.discipline || '';
    var loc = item.location_course || '';
    var weather = item.weather || '맑음';
    var gear = item.gear || '';
    var notes = item.notes || '';

    var photoIds = item.existingPhotoIds || [];

    if (item.photos && item.photos.length > 0) {
      try {
        var folderName = "운동일지_사진";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
        
        for (var p = 0; p < item.photos.length; p++) {
          var base64Data = item.photos[p];
          if (base64Data && base64Data.indexOf('data:') === 0) {
            var parts = base64Data.split(',');
            var contentType = parts[0].split(';')[0].replace('data:', '');
            var bytes = Utilities.base64Decode(parts[1]);
            var fileName = 'workout_' + dateStr + '_' + (p + 1) + '_' + (new Date().getTime()) + '.jpg';
            var blob = Utilities.newBlob(bytes, contentType, fileName);
            var file = folder.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            photoIds.push(file.getId());
          }
        }
      } catch(e) {
        Logger.log('Photo upload error: ' + e.message);
      }
    }

    var photoIdsStr = photoIds.join(',');

    // A열 ~ P열(16개 셀) 수정 (Q열 댓글은 보존)
    sheet.getRange(rowIndex, 1, 1, 16).setValues([[
      dateStr, sport, title, dur, rpe,
      dist, pace, elev, maxAlt, depth,
      disc, loc, weather, gear, notes,
      photoIdsStr
    ]]);

    return { success: true };
  } catch (e) {
    Logger.log("updateWorkout error: " + e.message);
    throw new Error("수정 실패: " + e.message);
  }
}

// 4. 🗑️ 운동 일지 삭제 API
function deleteWorkout(rowIndex) {
  try {
    if (!rowIndex || rowIndex < 2) {
      throw new Error("유효하지 않은 일지 번호입니다.");
    }
    var sheet = getSheet();
    sheet.deleteRow(rowIndex);
    return { success: true };
  } catch (e) {
    Logger.log("deleteWorkout error: " + e.message);
    throw new Error("삭제 실패: " + e.message);
  }
}

// 5. 💬 댓글 추가 API
function addWorkoutComment(rowIndex, commentData) {
  try {
    if (!rowIndex || rowIndex < 2) {
      throw new Error("유효하지 않은 일지 번호입니다.");
    }
    var sheet = getSheet();
    var cell = sheet.getRange(rowIndex, 17);
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
      author: String(commentData.author || '운동 동료').trim(),
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
    var logTitle = rowData[2] || rowData[1] || '운동 일지';

    sendNtfyCommentNotification(logDate, logTitle, newComment);

    return { success: true, comments: comments };
  } catch(e) {
    Logger.log("addWorkoutComment error: " + e.message);
    throw new Error("댓글 등록 실패: " + e.message);
  }
}

// 6. 💬 댓글 수정 API
function updateWorkoutComment(rowIndex, commentId, newText) {
  try {
    if (!rowIndex || rowIndex < 2 || !commentId) {
      throw new Error("유효하지 않은 댓글 정보입니다.");
    }
    var sheet = getSheet();
    var cell = sheet.getRange(rowIndex, 17);
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
    Logger.log("updateWorkoutComment error: " + e.message);
    throw new Error("댓글 수정 실패: " + e.message);
  }
}

// 7. 💬 댓글 삭제 API
function deleteWorkoutComment(rowIndex, commentId) {
  try {
    if (!rowIndex || rowIndex < 2 || !commentId) {
      throw new Error("유효하지 않은 댓글 정보입니다.");
    }
    var sheet = getSheet();
    var cell = sheet.getRange(rowIndex, 17);
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
    Logger.log("deleteWorkoutComment error: " + e.message);
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
      tags: tags || ["muscle"]
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

function sendNtfyWorkoutNotification(item) {
  var details = [];
  details.push("⏱️ " + item.duration_minutes + "분 (RPE " + item.intensity + ")");
  if (item.distance_km) details.push("📍 " + item.distance_km + "km (" + (item.pace || '-') + ")");
  if (item.elevation_gain) details.push("⛰️ +" + item.elevation_gain + "m");
  if (item.freedive_depth) details.push("🤿 " + item.freedive_depth + "m");
  if (item.location_course) details.push("📍 " + item.location_course);
  if (item.notes) details.push("\n💬 " + item.notes);

  var message = details.join(" | ");
  var title = "🏃 [" + item.sport + "] " + (item.title || (item.sport + ' 운동'));
  sendNtfyMessage(NTFY_TOPIC, title, message, ["runner", "muscle"]);
}

function sendNtfyCommentNotification(logDate, logTitle, comment) {
  var title = "💬 [" + comment.author + "님의 새 피드백]";
  var message = "📌 " + logDate + " " + logTitle + "\n\n\"" + comment.text + "\"";
  sendNtfyMessage(NTFY_TOPIC, title, message, ["speech_balloon"]);
}

function getEmptyOverview() {
  return {
    total_workouts: 0,
    total_duration_hours: 0,
    running_total_km: 0,
    total_elevation_gain: 0,
    freedive_max_depth: 0,
    sport_counts: {}
  };
}

function testWorkoutNtfyAlert() {
  var title = "🏃 [운동일지 알림 테스트] 성공!";
  var message = "스마트폰으로 종합 운동일지 알림이 정상적으로 수신됩니다! 🎉";
  sendNtfyMessage(NTFY_TOPIC, title, message, ["runner", "tada"]);
  Logger.log("운동일지 테스트 알림 발송 완료!");
}

// ==========================================
// 🟧 STRAVA API 연동 (Zepp / T-Rex 3 자동 동기화)
// ==========================================

function getStravaAccessToken() {
  var props = PropertiesService.getScriptProperties();
  var clientId = STRAVA_CLIENT_ID || props.getProperty("STRAVA_CLIENT_ID");
  var clientSecret = STRAVA_CLIENT_SECRET || props.getProperty("STRAVA_CLIENT_SECRET");
  var refreshToken = STRAVA_REFRESH_TOKEN || props.getProperty("STRAVA_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("STRAVA_NOT_CONFIGURED");
  }

  var url = "https://www.strava.com/oauth/token";
  var payload = {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  };
  var options = {
    method: "post",
    payload: payload,
    muteHttpExceptions: true
  };
  var res = UrlFetchApp.fetch(url, options);
  var json = JSON.parse(res.getContentText());
  if (json.access_token) {
    return json.access_token;
  } else {
    throw new Error("Strava 토큰 갱신 실패: " + (json.message || res.getContentText()));
  }
}

function getLatestStravaActivity() {
  try {
    var token;
    try {
      token = getStravaAccessToken();
    } catch(err) {
      if (err.message === "STRAVA_NOT_CONFIGURED") {
        return { success: false, notConfigured: true, message: "Strava API 키 설정이 필요합니다." };
      }
      throw err;
    }

    var url = "https://www.strava.com/api/v3/athlete/activities?per_page=1";
    var options = {
      method: "get",
      headers: { "Authorization": "Bearer " + token },
      muteHttpExceptions: true
    };
    var res = UrlFetchApp.fetch(url, options);
    var activities = JSON.parse(res.getContentText());
    if (!Array.isArray(activities) || activities.length === 0) {
      return { success: false, message: "Strava에 등록된 최근 운동이 없습니다." };
    }
    var act = activities[0];
    
    var rawDate = act.start_date_local || act.start_date || "";
    var dateStr = rawDate ? rawDate.substring(0, 10) : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    var durMin = Math.round((act.moving_time || act.elapsed_time || 0) / 60);
    var distKm = Math.round(((act.distance || 0) / 1000) * 100) / 100;
    var elevGain = Math.round(act.total_elevation_gain || 0);
    var maxAlt = Math.round(act.elev_high || 0);
    
    var sportType = act.sport_type || act.type || "Run";
    var mappedSport = "런닝";
    if (sportType === "Hike" || sportType === "Walk") {
      mappedSport = (sportType === "Hike" || elevGain > 200) ? "등산" : "걷기";
    } else if (sportType === "TrailRun") {
      mappedSport = "트레일런닝";
    } else if (sportType === "Swim") {
      mappedSport = "프리다이빙";
    } else if (sportType !== "Run") {
      mappedSport = "기타";
    }

    var paceStr = "";
    if (distKm > 0.1 && durMin > 0) {
      var p = durMin / distKm;
      var m = Math.floor(p);
      var s = Math.round((p - m) * 60);
      if (s === 60) { m += 1; s = 0; }
      paceStr = m + "'" + (s < 10 ? "0" : "") + s + '"';
    }

    var notesArr = [];
    if (act.average_heartrate) notesArr.push("❤️ 평균심박: " + Math.round(act.average_heartrate) + "bpm");
    if (act.max_heartrate) notesArr.push("최대심박: " + Math.round(act.max_heartrate) + "bpm");
    if (act.calories) notesArr.push("🔥 소모열량: " + Math.round(act.calories) + "kcal");
    if (act.description) notesArr.push("📝 " + act.description);

    var title = act.name || (distKm > 0 ? (distKm + "km " + mappedSport) : (mappedSport + " 운동"));
    if (distKm > 0 && paceStr) {
      title = distKm + "km " + mappedSport + " (" + paceStr + "/km)";
    } else if (mappedSport === "등산" && elevGain > 0) {
      title = (act.name && act.name !== "Hike" && act.name !== "등산") ? act.name : ("등산 (획득고도 +" + elevGain + "m)");
    }

    return {
      success: true,
      activity: {
        id: act.id,
        name: title,
        date: dateStr,
        sport: mappedSport,
        duration: durMin,
        distance: distKm,
        pace: paceStr,
        elevGain: elevGain,
        maxAlt: maxAlt,
        avgHr: act.average_heartrate ? Math.round(act.average_heartrate) : null,
        calories: act.calories || null,
        notes: notesArr.join(" | ")
      }
    };
  } catch(e) {
    Logger.log("getLatestStravaActivity error: " + e.message);
    return { success: false, error: e.message };
  }
}

function saveStravaSettings(clientId, clientSecret, refreshToken) {
  var props = PropertiesService.getScriptProperties();
  if (clientId) props.setProperty("STRAVA_CLIENT_ID", String(clientId).trim());
  if (clientSecret) props.setProperty("STRAVA_CLIENT_SECRET", String(clientSecret).trim());
  if (refreshToken) props.setProperty("STRAVA_REFRESH_TOKEN", String(refreshToken).trim());
  return { success: true };
}

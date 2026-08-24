/**
 * 종합 운동일지 백엔드 (Code.gs)
 * 티렉스 3 / Zepp 센서 데이터 연동 (심박, 칼로리, 케이던스, 하강고도, 잠수시간, 수온) + 제미나이 AI 요약 생성 + Q열 댓글 + ntfy 푸시 알림
 */

// 🔔 스마트폰 ntfy 앱에서 설정하신 토픽 이름을 적어주세요!
var NTFY_TOPIC = "my-workout-log-7788"; 

// 🔑 Google Gemini AI API Key (등록 완료)
var DEFAULT_GEMINI_API_KEY = "AQ.Ab8RN6I72Dj0lVu4k9TVb2j-24rQVj5I2VAvPovlf7CntVEXlA"; 

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
  
  // 1행 헤더 자동 점검 및 보충 (Q열 댓글 및 R~X열 센서 데이터 헤더)
  if (sheet.getLastRow() > 0) {
    var headers = [
      { col: 17, name: '댓글' },
      { col: 18, name: '평균심박수' },
      { col: 19, name: '최대심박수' },
      { col: 20, name: '소모칼로리' },
      { col: 21, name: '평균케이던스' },
      { col: 22, name: '하강고도' },
      { col: 23, name: '잠수시간' },
      { col: 24, name: '수온' }
    ];
    headers.forEach(function(h) {
      if (sheet.getLastColumn() < h.col || !sheet.getRange(1, h.col).getValue()) {
        sheet.getRange(1, h.col).setValue(h.name);
      }
    });
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
    var totalCalories = 0;
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

      // R~X열 티렉스 3 센서 데이터
      var avgHr = Number(row[17]) || 0;
      var maxHr = Number(row[18]) || 0;
      var calories = Number(row[19]) || 0;
      var cadence = Number(row[20]) || 0;
      var elevLoss = Number(row[21]) || 0;
      var diveTime = String(row[22] || '').trim();
      var waterTemp = row[23] !== undefined && row[23] !== '' ? row[23] : '';

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
      totalCalories += calories;
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
        comments: comments,
        // R~X열
        avg_hr: avgHr,
        max_hr: maxHr,
        calories: calories,
        cadence: cadence,
        elevation_loss: elevLoss,
        dive_time: diveTime,
        water_temp: waterTemp
      });
    }

    // 🌟 1순위: 날짜 내림차순, 2순위: 최근 입력한 행(높은 rowIndex)이 맨 위에 오도록 정렬
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
        total_calories: totalCalories,
        sport_counts: sportCounts
      },
      monthly_trends: monthlyTrends
    };
  } catch (e) {
    Logger.log("getWorkoutData error: " + e.message);
    return { logs: [], overview: getEmptyOverview(), monthly_trends: [], error: e.message };
  }
}

// 2. 새 운동 기록 저장 (A~X열 24개 항목)
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
    var disc = item.discipline || item.custom_sport || '';
    var loc = item.location_course || item.location || '';
    var weather = item.weather || '맑음';
    var gear = item.gear || '';
    var notes = item.notes || '';
    var photoIds = [];

    // R~X열
    var avgHr = item.avg_hr || '';
    var maxHr = item.max_hr || '';
    var calories = item.calories || '';
    var cadence = item.cadence || '';
    var elevLoss = item.elevation_loss || '';
    var diveTime = item.dive_time || '';
    var waterTemp = item.water_temp !== undefined ? item.water_temp : '';

    if (item.photos && item.photos.length > 0) {
      try {
        var folderName = "운동일지_사진";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder;
        if (folders.hasNext()) {
          folder = folders.next();
        } else {
          folder = DriveApp.createFolder(folderName);
        }
        try {
          folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch(eShare) {}
        
        for (var p = 0; p < item.photos.length; p++) {
          var base64Data = item.photos[p];
          if (base64Data && base64Data.indexOf('data:') === 0) {
            var parts = base64Data.split(',');
            var contentType = parts[0].split(';')[0].replace('data:', '');
            var bytes = Utilities.base64Decode(parts[1]);
            var fileName = 'workout_' + dateStr + '_' + (p + 1) + '_' + (new Date().getTime()) + '.jpg';
            var blob = Utilities.newBlob(bytes, contentType, fileName);
            var file = folder.createFile(blob);
            try {
              file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            } catch(eFileShare) {}
            photoIds.push(file.getId());
          }
        }
      } catch(e) {
        Logger.log('Photo upload error: ' + e.message);
      }
    }

    var photoIdsStr = photoIds.join(',');

    // A열 ~ X열 (총 24개 열)
    sheet.appendRow([
      dateStr, sport, title, dur, rpe,
      dist, pace, elev, maxAlt, depth,
      disc, loc, weather, gear, notes,
      photoIdsStr, "[]",
      avgHr, maxHr, calories, cadence, elevLoss, diveTime, waterTemp
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
    var disc = item.discipline || item.custom_sport || '';
    var loc = item.location_course || item.location || '';
    var weather = item.weather || '맑음';
    var gear = item.gear || '';
    var notes = item.notes || '';

    // R~X열
    var avgHr = item.avg_hr || '';
    var maxHr = item.max_hr || '';
    var calories = item.calories || '';
    var cadence = item.cadence || '';
    var elevLoss = item.elevation_loss || '';
    var diveTime = item.dive_time || '';
    var waterTemp = item.water_temp !== undefined ? item.water_temp : '';

    var photoIds = item.existingPhotoIds || [];

    if (item.photos && item.photos.length > 0) {
      try {
        var folderName = "운동일지_사진";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder;
        if (folders.hasNext()) {
          folder = folders.next();
        } else {
          folder = DriveApp.createFolder(folderName);
        }
        try {
          folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch(eShare) {}
        
        for (var p = 0; p < item.photos.length; p++) {
          var base64Data = item.photos[p];
          if (base64Data && base64Data.indexOf('data:') === 0) {
            var parts = base64Data.split(',');
            var contentType = parts[0].split(';')[0].replace('data:', '');
            var bytes = Utilities.base64Decode(parts[1]);
            var fileName = 'workout_' + dateStr + '_' + (p + 1) + '_' + (new Date().getTime()) + '.jpg';
            var blob = Utilities.newBlob(bytes, contentType, fileName);
            var file = folder.createFile(blob);
            try {
              file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            } catch(eFileShare) {}
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

    // R열 ~ X열(7개 셀) 수정
    sheet.getRange(rowIndex, 18, 1, 7).setValues([[
      avgHr, maxHr, calories, cadence, elevLoss, diveTime, waterTemp
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
      throw new Error("유효하지 않은 댓글 번호입니다.");
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

    var target = null;
    for (var i = 0; i < comments.length; i++) {
      if (comments[i].id === commentId) {
        comments[i].text = String(newText || '').trim();
        comments[i].updatedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
        target = comments[i];
        break;
      }
    }

    if (!target) {
      throw new Error("수정할 댓글을 찾을 수 없습니다.");
    }

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
      throw new Error("유효하지 않은 요청입니다.");
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

    var filtered = comments.filter(function(c) { return c.id !== commentId; });
    cell.setValue(JSON.stringify(filtered));
    return { success: true, comments: filtered };
  } catch(e) {
    Logger.log("deleteWorkoutComment error: " + e.message);
    throw new Error("댓글 삭제 실패: " + e.message);
  }
}

// ==========================================
// 🤖 GEMINI AI 운동 분석 및 요약 생성 API
// ==========================================

function generateGeminiWorkoutSummary(item) {
  try {
    var props = PropertiesService.getScriptProperties();
    var apiKey = (item && item.geminiApiKey) || DEFAULT_GEMINI_API_KEY || props.getProperty("GEMINI_API_KEY");

    // API Key가 전혀 없는 경우
    if (!apiKey || !apiKey.trim()) {
      return {
        success: true,
        summary: generateSmartCoachTemplate(item),
        hasApiKey: false,
        notice: "Gemini API 키가 등록되지 않아 기본 템플릿이 적용되었습니다."
      };
    }

    apiKey = apiKey.trim();

    var sport = item.sport || '운동';
    var date = item.date || '';
    var dur = item.duration_minutes || 0;
    var dist = item.distance_km || 0;
    var pace = item.pace || '';
    var avgHr = item.avg_hr || '';
    var maxHr = item.max_hr || '';
    var cal = item.calories || '';
    var cad = item.cadence || '';
    var elevGain = item.elevation_gain || '';
    var elevLoss = item.elevation_loss || '';
    var maxAlt = item.max_altitude || '';
    var depth = item.freedive_depth || '';
    var diveTime = item.dive_time || '';
    var waterTemp = item.water_temp || '';
    var rpe = item.intensity || 5;
    var loc = item.location_course || item.location || '';
    var weather = item.weather || '';

    var prompt = "너는 엘리트 마라토너이자 산악 트레일런, 프리다이빙 전문 수석 코치야.\n" +
      "사용자가 Amazfit T-Rex 3 스마트워치로 측정한 다음 운동 데이터를 바탕으로, 운동 일지 '메모/후기'란에 바로 넣을 수 있는 감탄과 전문성이 느껴지는 코칭 분석 요약글을 작성해줘.\n\n" +
      "【운동 측정 데이터】\n" +
      "- 종목: " + sport + "\n" +
      "- 날짜: " + date + "\n" +
      (dur ? "- 운동시간: " + dur + "분\n" : "") +
      (dist ? "- 이동거리: " + dist + "km\n" : "") +
      (pace ? "- 평균페이스: " + pace + "/km\n" : "") +
      (avgHr ? "- 평균심박수: " + avgHr + " bpm" + (maxHr ? " (최고 " + maxHr + " bpm)" : "") + "\n" : "") +
      (cal ? "- 소모칼로리: " + cal + " kcal\n" : "") +
      (cad ? "- 평균케이던스: " + cad + " spm\n" : "") +
      (elevGain ? "- 누적상승: +" + elevGain + "m" + (elevLoss ? ", 누적하강: -" + elevLoss + "m" : "") + (maxAlt ? ", 최고고도: " + maxAlt + "m" : "") + "\n" : "") +
      (depth ? "- 최대수심: " + depth + "m" + (diveTime ? ", 잠수시간: " + diveTime : "") + (waterTemp ? ", 수온: " + waterTemp + "℃" : "") + "\n" : "") +
      "- 운동강도(RPE): " + rpe + "/10\n" +
      (loc ? "- 장소: " + loc + "\n" : "") +
      (weather ? "- 날씨: " + weather + "\n" : "") +
      "\n" +
      "【작성 규칙】\n" +
      "1. 3~4문장 내외로 군더더기 없이 임팩트 있고 전문적으로 작성할 것.\n" +
      "2. [📊 데이터 심층 분석]과 [💡 코치 처방 & 회복 가이드] 2개 소제목과 이모지로 구성할 것.\n" +
      "3. 심박 존(유산소 Zone 2~3), 케이던스(180spm 부상 방지 및 주법 효율), 페이스, 상승/하강 고도 등의 수치를 자연스럽게 인용해 칭찬과 실질적 피드백을 제공할 것.\n" +
      "4. 친절하고 활기찬 한국어 말투(~하셨습니다, ~추천합니다)로 작성할 것.";

    // 최신 지원 모델 엔드포인트 목록 (gemini-3.6-flash 최우선)
    var modelsToTry = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest", "gemini-3-flash-preview"];
    var lastError = "";

    for (var i = 0; i < modelsToTry.length; i++) {
      var modelName = modelsToTry[i];
      var url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelName + ":generateContent?key=" + apiKey;
      
      var payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }
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
            if (!parts[p].thought && parts[p].text) {
              fullText += parts[p].text;
            }
          }
          if (!fullText.trim()) {
            fullText = parts[parts.length - 1].text || "";
          }

          if (fullText.trim()) {
            return {
              success: true,
              summary: fullText.trim(),
              hasApiKey: true,
              isAi: true
            };
          }
        }
      } else {
        lastError = "Model " + modelName + " Error (" + resCode + "): " + resText;
        Logger.log(lastError);
      }
    }

    // 모든 모델 실패 시 상세 에러 반환
    return {
      success: false,
      error: "Gemini API 호출 실패: " + lastError,
      summary: generateSmartCoachTemplate(item),
      hasApiKey: true
    };
  } catch(e) {
    Logger.log("generateGeminiWorkoutSummary error: " + e.message);
    return {
      success: false,
      error: e.message,
      summary: generateSmartCoachTemplate(item),
      hasApiKey: false
    };
  }
}

// 💡 스마트 스포츠 코치 템플릿 엔진 (오프라인 비상용)
function generateSmartCoachTemplate(item) {
  var sport = item.sport || '운동';
  var dist = item.distance_km || 0;
  var dur = item.duration_minutes || 0;
  var pace = item.pace || '';
  var avgHr = item.avg_hr || 0;
  var maxHr = item.max_hr || 0;
  var cal = item.calories || 0;
  var cad = item.cadence || 0;
  var elevGain = item.elevation_gain || 0;
  var elevLoss = item.elevation_loss || 0;
  var depth = item.freedive_depth || 0;
  var diveTime = item.dive_time || '';

  if (sport === '런닝' || sport === '트레일런닝') {
    var zoneText = avgHr >= 165 ? "고강도 무산소/젖산역치 Zone 4~5" : (avgHr >= 145 ? "효과적인 유산소 템포 Zone 3" : "안정적인 지방연소 및 심폐지구력 Zone 2");
    var cadenceFeedback = cad >= 175 ? "평균 케이던스 " + cad + " spm으로 보폭 과부하를 줄이고 피치를 극대화한 모범적인 주법이었습니다." : (cad > 0 ? "평균 케이던스 " + cad + " spm을 기록했습니다. (175~180 spm 목표 시 부상 방지 효과 UP)" : "");

    var p1 = "[📊 러닝 데이터 심층 분석]\n" +
      (dist ? dist + "km 거리를 " : "") + (dur ? dur + "분 동안 " : "") + (pace ? "평균 " + pace + "/km 페이스로 " : "") + "질주하셨습니다. " +
      (avgHr ? "평균 심박수 " + avgHr + " bpm" + (maxHr ? "(최대 " + maxHr + " bpm)" : "") + "으로 " + zoneText + " 영역을 훌륭하게 소화했습니다. " : "") +
      cadenceFeedback;

    var p2 = "\n\n[💡 코치 처방 & 다음 훈련 가이드]\n" +
      (cal ? "총 " + cal + " kcal를 소모하며 " : "") + "높은 운동 효율을 보였습니다. 훈련 후 아킬레스건과 햄스트링 롤링 스트레칭을 권장하며, 다음 세션에서는 가벼운 빌드업 러닝을 추천합니다! 🏃‍♂️🔥";

    return p1 + p2;
  } else if (sport === '등산') {
    var p1 = "[⛰️ 산행 고도 & 심폐 분석]\n" +
      (dur ? "총 " + dur + "분 동안 " : "") + "누적 상승 +" + elevGain + "m" + (elevLoss ? ", 누적 하강 -" + elevLoss + "m" : "") + " 산행 코스를 성공적으로 정복했습니다. " +
      (avgHr ? "평균 심박수 " + avgHr + " bpm으로 " : "") + "오르막 심폐 부하와 하산 지구력을 고르게 단련한 고효율 훈련이었습니다.";

    var p2 = "\n\n[💡 산행 회복 & 코칭 팁]\n" +
      "내리막 하강 구간의 충격으로 무릎과 대퇴사두근 피로가 높을 수 있으니 족욕 및 폼롤러 마사지를 추천합니다. " + (cal ? "총 " + cal + " kcal 소모 완료! 🏔️✨" : "");

    return p1 + p2;
  } else if (sport === '프리다이빙') {
    return "[🤿 다이브 로그 분석]\n" +
      "최대 수심 " + depth + "m" + (diveTime ? ", 잠수 시간 " + diveTime : "") + (item.water_temp ? ", 수온 " + item.water_temp + "℃" : "") + " 다이빙을 안전하게 마쳤습니다. " +
      "침착한 마인드 컨트롤과 정확한 압력 평형(이퀄라이징)이 돋보였습니다.\n\n" +
      "[💡 다이빙 리커버리] 체온 회복과 전해질 수분 보충을 충분히 해주세요! 🌊🤿";
  } else {
    return "[🏅 운동 분석 요약]\n" +
      sport + " 세션을 " + (dur ? dur + "분 동안 " : "") + "성공적으로 완수했습니다. " +
      (avgHr ? "평균 심박수 " + avgHr + " bpm, " : "") + (cal ? "소모 열량 " + cal + " kcal를 " : "") + "기록하며 높은 훈련 효율을 달성했습니다.\n\n" +
      "[💡 코칭 팁] 훈련 후 가벼운 리커버리 스트레칭으로 근육 피로를 풀어주세요! 👍✨";
  }
}

// 8. Gemini API Key 등록 편의 API
function saveGeminiApiKey(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("API 키를 입력해주세요.");
  }
  PropertiesService.getScriptProperties().setProperty("GEMINI_API_KEY", apiKey.trim());
  return { success: true };
}

// ==========================================
// 🔔 스마트폰 푸시 알림 (ntfy.sh)
// ==========================================

function sendNtfyWorkoutNotification(item) {
  if (!NTFY_TOPIC || NTFY_TOPIC === "my-workout-log-7788") return;
  try {
    var title = "🏃 [" + item.sport + "] " + (item.title || "새 운동 기록");
    var msgParts = [];
    if (item.duration_minutes) msgParts.push("⏱️ " + item.duration_minutes + "분");
    if (item.distance_km) msgParts.push("📏 " + item.distance_km + "km");
    if (item.pace) msgParts.push("⚡ " + item.pace);
    if (item.avg_hr) msgParts.push("❤️ " + item.avg_hr + "bpm");
    if (item.calories) msgParts.push("🔥 " + item.calories + "kcal");
    if (item.elevation_gain) msgParts.push("⛰️ +" + item.elevation_gain + "m");
    if (item.freedive_depth) msgParts.push("🤿 " + item.freedive_depth + "m");

    var message = msgParts.join(" | ") + (item.notes ? "\n\n📝 " + item.notes : "");
    sendNtfyMessage(NTFY_TOPIC, title, message, ["runner", "muscle"]);
  } catch (e) {
    Logger.log("sendNtfyWorkoutNotification error: " + e.message);
  }
}

function sendNtfyCommentNotification(dateStr, logTitle, comment) {
  if (!NTFY_TOPIC || NTFY_TOPIC === "my-workout-log-7788") return;
  try {
    var title = "💬 [" + logTitle + "] 새 댓글";
    var message = comment.author + ": " + comment.text + "\n(운동일: " + dateStr + ")";
    sendNtfyMessage(NTFY_TOPIC, title, message, ["speech_balloon", "tada"]);
  } catch (e) {
    Logger.log("sendNtfyCommentNotification error: " + e.message);
  }
}

function sendNtfyMessage(topic, title, message, tags) {
  var url = "https://ntfy.sh/" + encodeURIComponent(topic);
  var headers = {
    "Title": "=?UTF-8?B?" + Utilities.base64Encode(title, Utilities.Charset.UTF_8) + "?=",
    "Priority": "default"
  };
  if (tags && tags.length > 0) {
    headers["Tags"] = tags.join(",");
  }
  var options = {
    method: "post",
    headers: headers,
    payload: message,
    contentType: "text/plain; charset=utf-8",
    muteHttpExceptions: true
  };
  UrlFetchApp.fetch(url, options);
}

function testWorkoutNtfyAlert() {
  var title = "🏃 [운동일지 알림 테스트] 성공!";
  var message = "스마트폰으로 종합 운동일지 알림이 정상적으로 수신됩니다! 🎉";
  sendNtfyMessage(NTFY_TOPIC, title, message, ["runner", "tada"]);
  Logger.log("운동일지 테스트 알림 발송 완료!");
}

// 프론트엔드 호환용 별칭 (Aliases)
function saveWorkoutLog(data) { return saveWorkout(data); }
function updateWorkoutLog(data) { return updateWorkout(data); }
function deleteWorkoutLog(rowIndex) { return deleteWorkout(rowIndex); }

function getEmptyOverview() {
  return {
    total_workouts: 0,
    total_duration_hours: 0,
    running_total_km: 0,
    total_elevation_gain: 0,
    freedive_max_depth: 0,
    total_calories: 0,
    sport_counts: {}
  };
}

// 🔧 기존 업로드된 모든 사진의 공개 보기 권한 일괄 복구 함수
function fixAllPhotoPermissions() {
  try {
    var folderNames = ["운동일지_사진", "Tennis_Log_Photos", "테니스일지_사진"];
    var count = 0;
    for (var f = 0; f < folderNames.length; f++) {
      var folders = DriveApp.getFoldersByName(folderNames[f]);
      while (folders.hasNext()) {
        var folder = folders.next();
        try {
          folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch(e) {}
        var files = folder.getFiles();
        while (files.hasNext()) {
          var file = files.next();
          try {
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            count++;
          } catch(e) {}
        }
      }
    }
    return { success: true, count: count };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

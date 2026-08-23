
    let curSport = '런닝';
    let allLogs = [];
    let curFilter = 'all';
    let monthlyTrendsData = [];
    let chart1 = null, chart2 = null, chart3 = null;
    let selectedPhotos = [];

    document.addEventListener('DOMContentLoaded', () => {
      try {
        document.getElementById('inputDate').value = new Date().toISOString().split('T')[0];
        initPaceAutoCalc();
        loadData();
      } catch (err) {
        console.error('Init error:', err);
      }
    });

    function selectSport(sport) {
      curSport = sport;
      document.querySelectorAll('.sport-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-sport') === sport);
      });

      const boxRunning = document.getElementById('box-running');
      const boxHiking = document.getElementById('box-hiking');
      const boxFreedive = document.getElementById('box-freedive');
      const boxOther = document.getElementById('box-other');

      if (boxRunning) boxRunning.classList.toggle('hidden', !['런닝', '걷기', '트레일런닝'].includes(sport));
      if (boxHiking) boxHiking.classList.toggle('hidden', !['등산', '트레일런닝'].includes(sport));
      if (boxFreedive) boxFreedive.classList.toggle('hidden', sport !== '프리다이빙');
      if (boxOther) boxOther.classList.toggle('hidden', sport !== '기타');
    }

    function switchTab(tab) {
      try {
        const vNew = document.getElementById('view-new');
        const vList = document.getElementById('view-list');
        const vCharts = document.getElementById('view-charts');

        const tNew = document.getElementById('tab-new');
        const tList = document.getElementById('tab-list');
        const tCharts = document.getElementById('tab-charts');

        if (vNew) vNew.classList.toggle('hidden', tab !== 'new');
        if (vList) vList.classList.toggle('hidden', tab !== 'list');
        if (vCharts) vCharts.classList.toggle('hidden', tab !== 'charts');

        if (tNew) tNew.classList.toggle('active', tab === 'new');
        if (tList) tList.classList.toggle('active', tab === 'list');
        if (tCharts) tCharts.classList.toggle('active', tab === 'charts');

        if (tab === 'list') renderLogs();
        if (tab === 'charts') setTimeout(renderAllCharts, 50);
      } catch (err) {
        console.error('Tab switch error:', err);
      }
    }

    // Multi Photo Selection & Auto-Compression (Max 5 photos)
    function handlePhotosSelect(e) {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      const remainingSlots = 5 - selectedPhotos.length;
      if (remainingSlots <= 0) {
        alert('사진은 최대 5장까지만 등록할 수 있습니다.');
        return;
      }

      const filesToProcess = files.slice(0, remainingSlots);
      showToast(`${filesToProcess.length}장의 사진 최적화 중...`);

      let processedCount = 0;
      filesToProcess.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(evt) {
          const img = new Image();
          img.onload = function() {
            const maxDim = 1280;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const base64 = canvas.toDataURL('image/jpeg', 0.8);

            selectedPhotos.push(base64);
            processedCount++;

            if (processedCount === filesToProcess.length) {
              renderPhotoPreviews();
              showToast(`총 ${selectedPhotos.length}장의 사진이 첨부되었습니다! 📸`);
            }
          };
          img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
      });

      e.target.value = '';
    }

    function renderPhotoPreviews() {
      const grid = document.getElementById('photosPreviewGrid');
      const countText = document.getElementById('photoCountText');
      const removeBtn = document.getElementById('btnRemoveAllPhotos');

      if (countText) countText.textContent = `${selectedPhotos.length}/5`;

      if (selectedPhotos.length === 0) {
        if (grid) { grid.innerHTML = ''; grid.classList.add('hidden'); }
        if (removeBtn) removeBtn.classList.add('hidden');
        return;
      }

      if (grid) grid.classList.remove('hidden');
      if (removeBtn) removeBtn.classList.remove('hidden');

      if (grid) {
        grid.innerHTML = selectedPhotos.map((b64, idx) => `
          <div class="photo-preview-item">
            <img src="${b64}" alt="미리보기 ${idx + 1}">
            <button type="button" class="photo-delete-btn" onclick="removePhotoAt(${idx})" title="삭제">✕</button>
          </div>
        `).join('');
      }
    }

    function removePhotoAt(idx) {
      selectedPhotos.splice(idx, 1);
      renderPhotoPreviews();
    }

    function removeAllPhotos() {
      selectedPhotos = [];
      renderPhotoPreviews();
    }

    function openPhotoModal(imgUrl) {
      const modal = document.getElementById('photoModal');
      const img = document.getElementById('photoModalImg');
      if (img) img.src = imgUrl;
      if (modal) modal.classList.remove('hidden');
    }

    function closePhotoModal() {
      const modal = document.getElementById('photoModal');
      if (modal) modal.classList.add('hidden');
    }

    function initPaceAutoCalc() {
      const dist = document.getElementById('inputDistance');
      const dur = document.getElementById('inputDuration');
      const pace = document.getElementById('inputPace');

      function calc() {
        if (!dist || !dur || !pace) return;
        const d = parseFloat(dist.value);
        const t = parseFloat(dur.value);
        if (d > 0 && t > 0) {
          const paceDec = t / d;
          const m = Math.floor(paceDec);
          const s = Math.round((paceDec - m) * 60);
          pace.value = `${m}'${s < 10 ? '0' : ''}${s}"`;
        }
      }
      if (dist) dist.addEventListener('input', calc);
      if (dur) dur.addEventListener('input', calc);
    }

    function loadData() {
      showToast('구글 드라이브 동기화 중...');
      google.script.run
        .withSuccessHandler(res => {
          allLogs = (res && res.logs) || [];
          monthlyTrendsData = (res && res.monthly_trends) || [];
          updateStats(res && res.overview);
          renderLogs();
          showToast('동기화 완료!');
        })
        .withFailureHandler(err => {
          showToast('오류: ' + err.message);
        })
        .getWorkoutData();
    }

    function updateStats(overview) {
      if (!overview) return;
      const elTotal = document.getElementById('stat-total-workouts');
      const elHours = document.getElementById('stat-total-hours');
      const elKm = document.getElementById('stat-running-km');
      const elElev = document.getElementById('stat-elevation-m');

      if (elTotal) elTotal.textContent = `${overview.total_workouts || 0} 회`;
      if (elHours) elHours.textContent = `${overview.total_duration_hours || 0} 시간`;
      if (elKm) elKm.textContent = `${overview.running_total_km || 0} km`;
      if (elElev) elElev.textContent = `+${(overview.total_elevation_gain || 0).toLocaleString()} m`;
    }

    function handleSubmit(e) {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = selectedPhotos.length > 0 ? `사진 ${selectedPhotos.length}장 및 일지 저장 중...` : '저장 중...';
      }

      const inputTitle = document.getElementById('inputTitle');
      const inputDuration = document.getElementById('inputDuration');
      const inputIntensity = document.getElementById('inputIntensity');
      const inputDistance = document.getElementById('inputDistance');
      const inputPace = document.getElementById('inputPace');
      const inputElevation = document.getElementById('inputElevation');
      const inputMaxAlt = document.getElementById('inputMaxAlt');
      const inputDepth = document.getElementById('inputDepth');
      const inputCustomSport = document.getElementById('inputCustomSport');
      const inputDiscipline = document.getElementById('inputDiscipline');
      const inputLocation = document.getElementById('inputLocation');
      const inputWeather = document.getElementById('inputWeather');
      const inputNotes = document.getElementById('inputNotes');

      const data = {
        date: document.getElementById('inputDate').value,
        sport: curSport,
        title: inputTitle ? inputTitle.value.trim() : '',
        duration_minutes: inputDuration ? (parseInt(inputDuration.value) || 0) : 0,
        intensity: inputIntensity ? (parseInt(inputIntensity.value) || 5) : 5,
        distance_km: inputDistance ? (parseFloat(inputDistance.value) || '') : '',
        pace: inputPace ? inputPace.value.trim() : '',
        elevation_gain: inputElevation ? (parseInt(inputElevation.value) || '') : '',
        max_altitude: inputMaxAlt ? (parseInt(inputMaxAlt.value) || '') : '',
        freedive_depth: inputDepth ? (parseFloat(inputDepth.value) || '') : '',
        discipline: (curSport === '기타' ? (inputCustomSport ? inputCustomSport.value.trim() : '') : (inputDiscipline ? inputDiscipline.value.trim() : '')),
        location_course: inputLocation ? inputLocation.value.trim() : '',
        weather: inputWeather ? inputWeather.value : '맑음',
        notes: inputNotes ? inputNotes.value.trim() : '',
        photos: selectedPhotos
      };

      google.script.run
        .withSuccessHandler(() => {
          showToast(`구글 드라이브에 저장 완료! (사진 ${selectedPhotos.length}장) 📸`);
          document.getElementById('workoutForm').reset();
          document.getElementById('inputDate').value = new Date().toISOString().split('T')[0];
          removeAllPhotos();
          if (btn) {
            btn.disabled = false;
            btn.textContent = '💾 구글 드라이브에 저장하기';
          }
          loadData();
          switchTab('list');
        })
        .withFailureHandler(err => {
          alert('저장 실패: ' + err.message);
          if (btn) {
            btn.disabled = false;
            btn.textContent = '다시 시도';
          }
        })
        .saveWorkout(data);
    }

    function filterLogs(sport) {
      curFilter = sport;
      document.querySelectorAll('.filter-pill').forEach(p => {
        p.classList.toggle('active', p.textContent.includes(sport === 'all' ? '전체' : sport));
      });
      renderLogs();
    }

    function renderLogs() {
      const container = document.getElementById('logsContainer');
      if (!container) return;

      const filtered = allLogs.filter(l => curFilter === 'all' || l.sport === curFilter);

      if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8; font-size:13px;">기록이 없습니다.</div>';
        return;
      }

      container.innerHTML = filtered.map(log => {
        let photosHtml = '';
        if (log.photo_ids && log.photo_ids.length > 0) {
          const isSingle = log.photo_ids.length === 1;
          const itemsHtml = log.photo_ids.map(id => {
            const cdnUrl = `https://lh3.googleusercontent.com/d/${id}=s800`;
            const fullUrl = `https://lh3.googleusercontent.com/d/${id}=s1600`;
            const fallbackUrl = `https://drive.google.com/thumbnail?id=${id}&sz=w800`;

            return `
              <div class="log-photo-item ${isSingle ? 'single' : ''}" onclick="openPhotoModal('${fullUrl}')">
                <img src="${cdnUrl}" onerror="this.onerror=null; this.src='${fallbackUrl}';" referrerpolicy="no-referrer" loading="lazy" alt="운동 사진">
              </div>
            `;
          }).join('');

          photosHtml = `
            <div style="margin-top:8px;">
              ${!isSingle ? `<div style="font-size:11px; font-weight:700; color:#64748b; margin-bottom:4px;">📸 사진 ${log.photo_ids.length}장 (좌우 스크롤 / 터치하여 확대)</div>` : ''}
              <div class="log-photos-gallery">
                ${itemsHtml}
              </div>
            </div>
          `;
        }

        return `
          <div class="log-item">
            <div class="log-item-header">
              <span class="sport-tag">${log.sport}</span>
              <span class="log-date">${log.date} (RPE ${log.intensity || 5})</span>
            </div>
            <div class="log-title">${log.title || log.sport + ' 운동'}</div>
            <div class="log-metrics">
              ${log.distance_km ? `<span class="metric-dist">📍 ${log.distance_km} km</span>` : ''}
              ${log.pace ? `<span>⏱️ ${log.pace}</span>` : ''}
              ${log.elevation_gain ? `<span class="metric-elev">⛰️ +${log.elevation_gain}m</span>` : ''}
              ${log.freedive_depth ? `<span class="metric-depth">🤿 ${log.freedive_depth}m</span>` : ''}
              ${log.duration_minutes ? `<span>⌛ ${log.duration_minutes}분</span>` : ''}
            </div>
            ${log.notes ? `<div class="log-notes">${log.notes}</div>` : ''}
            ${photosHtml}
          </div>
        `;
      }).join('');
    }

    // Render Charts
    function renderAllCharts() {
      try {
        if (typeof Chart === 'undefined') return;

        // 1. Activity Bar Chart
        const ctx1 = document.getElementById('chartActivity');
        if (ctx1 && monthlyTrendsData.length > 0) {
          if (chart1) chart1.destroy();
          const months = monthlyTrendsData.map(m => m.month);
          const sports = ['런닝', '등산', '트레일런닝', '프리다이빙', '걷기', '기타'];
          const colors = {
            '런닝': '#ea580c', '등산': '#16a34a', '트레일런닝': '#0d9488',
            '프리다이빙': '#0284c7', '걷기': '#9333ea', '기타': '#e11d48'
          };

          const datasets = sports.map(sp => ({
            label: sp,
            data: monthlyTrendsData.map(m => (m.counts && m.counts[sp]) || 0),
            backgroundColor: colors[sp] || '#64748b',
            borderRadius: 4
          }));

          chart1 = new Chart(ctx1, {
            type: 'bar',
            data: { labels: months, datasets: datasets },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } }
            }
          });
        }

        // 2. Mileage Line Chart
        const ctx2 = document.getElementById('chartMileage');
        if (ctx2 && allLogs.length > 0) {
          if (chart2) chart2.destroy();
          const runWalkLogs = allLogs.filter(l => (l.sport === '런닝' || l.sport === '걷기' || l.sport === '트레일런닝') && l.distance_km > 0).sort((a,b) => new Date(a.date) - new Date(b.date));
          
          if (runWalkLogs.length > 0) {
            chart2 = new Chart(ctx2, {
              type: 'line',
              data: {
                labels: runWalkLogs.map(l => l.date),
                datasets: [{
                  label: '거리 (km)',
                  data: runWalkLogs.map(l => l.distance_km),
                  borderColor: '#ea580c',
                  backgroundColor: 'rgba(234, 88, 12, 0.1)',
                  tension: 0.2,
                  fill: true
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } }
              }
            });
          }
        }

        // 3. Elevation Gain Chart
        const ctx3 = document.getElementById('chartElevation');
        if (ctx3 && allLogs.length > 0) {
          if (chart3) chart3.destroy();
          const hikeLogs = allLogs.filter(l => (l.sport === '등산' || l.sport === '트레일런닝') && l.elevation_gain > 0).sort((a,b) => new Date(a.date) - new Date(b.date));

          if (hikeLogs.length > 0) {
            chart3 = new Chart(ctx3, {
              type: 'bar',
              data: {
                labels: hikeLogs.map(l => l.date),
                datasets: [{
                  label: '획득고도 (m)',
                  data: hikeLogs.map(l => l.elevation_gain),
                  backgroundColor: '#16a34a',
                  borderRadius: 4
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } }
              }
            });
          }
        }
      } catch (err) {
        console.error('Chart render error:', err);
      }
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2200);
    }
  
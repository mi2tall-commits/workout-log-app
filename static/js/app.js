const SPORT_CONFIG = {
    running: { name: '런닝', icon: 'zap', color: 'orange', badgeClass: 'sport-badge-running', activeClass: 'active-running' },
    hiking: { name: '등산', icon: 'mountain', color: 'emerald', badgeClass: 'sport-badge-hiking', activeClass: 'active-hiking' },
    trail_running: { name: '트레일런닝', icon: 'trees', color: 'teal', badgeClass: 'sport-badge-trail_running', activeClass: 'active-trail_running' },
    freediving: { name: '프리다이빙', icon: 'waves', color: 'sky', badgeClass: 'sport-badge-freediving', activeClass: 'active-freediving' },
    walking: { name: '걷기', icon: 'footprints', color: 'purple', badgeClass: 'sport-badge-walking', activeClass: 'active-walking' },
    other: { name: '기타', icon: 'dumbbell', color: 'rose', badgeClass: 'sport-badge-other', activeClass: 'active-other' }
};

let currentSport = 'running';
let currentFilterSport = 'all';
let allLogs = [];
let editingLogId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initDefaultDate();
    setupEventListeners();
    setupPaceCalculation();
    loadDashboardAndLogs();
});

function initDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('inputDate');
    if (dateInput) dateInput.value = today;
}

function setupEventListeners() {
    // Sport Selection in Form
    document.querySelectorAll('.sport-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sport = btn.getAttribute('data-sport');
            setFormSport(sport);
        });
    });

    // Main Tab Navigation (Dashboard, New Log, Log List, Analytics)
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetView = tab.getAttribute('data-view');
            switchMainView(targetView);
        });
    });

    // Sport Filter in Log List
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.className = 'filter-tab px-4 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition');
            const sport = tab.getAttribute('data-sport');
            tab.className = `filter-tab px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition tab-active-${sport}`;
            currentFilterSport = sport;
            loadLogs();
        });
    });

    // Search and Date Filters
    const searchInput = document.getElementById('searchInput');
    const startDateInput = document.getElementById('filterStartDate');
    const endDateInput = document.getElementById('filterEndDate');
    const resetFilterBtn = document.getElementById('resetFilterBtn');

    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => loadLogs(), 300);
        });
    }

    if (startDateInput) startDateInput.addEventListener('change', () => loadLogs());
    if (endDateInput) endDateInput.addEventListener('change', () => loadLogs());
    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (startDateInput) startDateInput.value = '';
            if (endDateInput) endDateInput.value = '';
            currentFilterSport = 'all';
            document.querySelectorAll('.filter-tab').forEach(t => {
                if (t.getAttribute('data-sport') === 'all') {
                    t.className = 'filter-tab px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition tab-active-all';
                } else {
                    t.className = 'filter-tab px-4 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition';
                }
            });
            loadLogs();
        });
    }

    // Intensity Slider
    const intensityRange = document.getElementById('inputIntensity');
    const intensityValue = document.getElementById('intensityValue');
    if (intensityRange && intensityValue) {
        intensityRange.addEventListener('input', (e) => {
            intensityValue.textContent = `${e.target.value} / 10`;
        });
    }

    // Form Submit
    const workoutForm = document.getElementById('workoutForm');
    if (workoutForm) {
        workoutForm.addEventListener('submit', handleFormSubmit);
    }

    // Cancel Edit Button
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', resetForm);
    }

    // Export & Import
    const exportBtn = document.getElementById('exportBtn');
    const importFile = document.getElementById('importFile');
    if (exportBtn) exportBtn.addEventListener('click', handleExport);
    if (importFile) importFile.addEventListener('change', handleImport);
}

// Switch Views
function switchMainView(viewName) {
    document.querySelectorAll('.nav-tab').forEach(t => {
        if (t.getAttribute('data-view') === viewName) {
            t.classList.add('border-indigo-600', 'text-indigo-600');
            t.classList.remove('border-transparent', 'text-slate-500');
        } else {
            t.classList.remove('border-indigo-600', 'text-indigo-600');
            t.classList.add('border-transparent', 'text-slate-500');
        }
    });

    document.querySelectorAll('.view-section').forEach(sec => {
        sec.classList.add('hidden');
    });

    const targetSec = document.getElementById(`view-${viewName}`);
    if (targetSec) {
        targetSec.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (viewName === 'analytics' || viewName === 'dashboard') {
        loadDashboardAndLogs();
    }
}

// Sport form field toggle
function setFormSport(sport) {
    currentSport = sport;

    // Reset button active classes
    document.querySelectorAll('.sport-btn').forEach(btn => {
        const s = btn.getAttribute('data-sport');
        btn.className = 'sport-btn flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition font-medium text-slate-700 text-sm';
        if (s === sport) {
            btn.classList.add(SPORT_CONFIG[sport].activeClass);
        }
    });

    // Toggle Section Fields
    const runWalkSection = document.getElementById('fields-running-walking');
    const hikeTrailSection = document.getElementById('fields-hiking-trail');
    const freedivingSection = document.getElementById('fields-freediving');
    const otherSection = document.getElementById('fields-other');

    if (runWalkSection) runWalkSection.classList.add('hidden');
    if (hikeTrailSection) hikeTrailSection.classList.add('hidden');
    if (freedivingSection) freedivingSection.classList.add('hidden');
    if (otherSection) otherSection.classList.add('hidden');

    if (sport === 'running' || sport === 'walking') {
        if (runWalkSection) runWalkSection.classList.remove('hidden');
    } else if (sport === 'hiking' || sport === 'trail_running') {
        if (hikeTrailSection) hikeTrailSection.classList.remove('hidden');
        if (sport === 'trail_running' && runWalkSection) {
            // Also show pace and cadence for trail running
            runWalkSection.classList.remove('hidden');
        }
    } else if (sport === 'freediving') {
        if (freedivingSection) freedivingSection.classList.remove('hidden');
    } else if (sport === 'other') {
        if (otherSection) otherSection.classList.remove('hidden');
    }

    // Refresh icons
    lucide.createIcons();
}

// Auto Pace Calculator
function setupPaceCalculation() {
    const distInput = document.getElementById('inputDistance');
    const durInput = document.getElementById('inputDuration');
    const paceInput = document.getElementById('inputPace');

    function calculate() {
        const dist = parseFloat(distInput.value);
        const dur = parseFloat(durInput.value);

        if (dist > 0 && dur > 0) {
            const paceMinPerKm = dur / dist;
            const minutes = Math.floor(paceMinPerKm);
            const seconds = Math.round((paceMinPerKm - minutes) * 60);
            paceInput.value = `${minutes}'${seconds < 10 ? '0' : ''}${seconds}"`;
        }
    }

    if (distInput) distInput.addEventListener('input', calculate);
    if (durInput) durInput.addEventListener('input', calculate);
}

// Load Dashboard & Logs
async function loadDashboardAndLogs() {
    try {
        const stats = await API.getStats();
        updateDashboardCards(stats.overview);

        const logsData = await API.getLogs();
        allLogs = logsData.logs || [];

        renderRecentLogs(stats.recent || []);
        renderAllLogs(allLogs);

        // Render Charts
        ChartsManager.renderCharts(stats.monthly_trends || [], allLogs);

        lucide.createIcons();
    } catch (err) {
        console.error(err);
        showToast(err.message, 'error');
    }
}

// Update Top Dashboard Stat Cards
function updateDashboardCards(overview) {
    if (!overview) return;

    document.getElementById('stat-total-workouts').textContent = `${overview.total_workouts} 회`;
    document.getElementById('stat-total-hours').textContent = `${overview.total_duration_hours} 시간`;
    document.getElementById('stat-running-km').textContent = `${overview.running_total_km} km`;
    document.getElementById('stat-elevation-m').textContent = `+${overview.total_elevation_gain.toLocaleString()} m`;
    document.getElementById('stat-freedive-depth').textContent = overview.freedive_max_depth > 0 ? `${overview.freedive_max_depth} m` : '-';
}

// Load logs with active filters
async function loadLogs() {
    try {
        const searchInput = document.getElementById('searchInput');
        const startDateInput = document.getElementById('filterStartDate');
        const endDateInput = document.getElementById('filterEndDate');

        const params = {
            sport: currentFilterSport,
            search: searchInput ? searchInput.value.trim() : '',
            startDate: startDateInput ? startDateInput.value : '',
            endDate: endDateInput ? endDateInput.value : ''
        };

        const res = await API.getLogs(params);
        renderAllLogs(res.logs || []);
    } catch (err) {
        console.error(err);
        showToast(err.message, 'error');
    }
}

// Render Recent Logs on Dashboard
function renderRecentLogs(logs) {
    const container = document.getElementById('recentLogsContainer');
    if (!container) return;

    if (logs.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-400">
                <i data-lucide="calendar-x" class="w-10 h-10 mx-auto mb-2 opacity-50"></i>
                <p>아직 등록된 운동 기록이 없습니다.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    container.innerHTML = logs.map(log => createLogCardHtml(log)).join('');
    lucide.createIcons();
}

// Render All Logs on Timeline/List View
function renderAllLogs(logs) {
    const container = document.getElementById('allLogsContainer');
    const countBadge = document.getElementById('logsCountBadge');
    if (countBadge) countBadge.textContent = `${logs.length}개의 기록`;

    if (!container) return;

    if (logs.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-400">
                <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>
                <p class="text-base font-medium">조건에 맞는 운동 기록이 없습니다.</p>
                <p class="text-sm text-slate-400 mt-1">새 운동을 기록하거나 검색 필터를 초기화해 보세요.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    container.innerHTML = logs.map(log => createLogCardHtml(log, true)).join('');
    lucide.createIcons();
}

// Create Card HTML
function createLogCardHtml(log, isFullView = false) {
    const config = SPORT_CONFIG[log.sport] || { name: log.sport, icon: 'activity', badgeClass: 'bg-slate-100 text-slate-700', color: 'slate' };
    
    // Highlight metrics based on sport
    let keyMetricsHtml = '';
    if (log.sport === 'running' || log.sport === 'walking') {
        keyMetricsHtml = `
            <div class="flex items-center gap-4 text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                ${log.distance_km ? `<div class="flex items-center gap-1 font-semibold text-slate-800"><i data-lucide="map-pin" class="w-4 h-4 text-orange-500"></i> ${log.distance_km} km</div>` : ''}
                ${log.pace ? `<div class="flex items-center gap-1"><i data-lucide="timer" class="w-4 h-4 text-slate-400"></i> 페이스 ${log.pace}</div>` : ''}
                ${log.avg_hr ? `<div class="flex items-center gap-1"><i data-lucide="heart" class="w-4 h-4 text-rose-500"></i> ${log.avg_hr} bpm</div>` : ''}
            </div>
        `;
    } else if (log.sport === 'hiking' || log.sport === 'trail_running') {
        keyMetricsHtml = `
            <div class="flex flex-wrap items-center gap-3 text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                ${log.elevation_gain ? `<div class="flex items-center gap-1 font-semibold text-emerald-700"><i data-lucide="trending-up" class="w-4 h-4"></i> +${log.elevation_gain} m</div>` : ''}
                ${log.distance_km ? `<div class="flex items-center gap-1"><i data-lucide="map-pin" class="w-4 h-4 text-teal-600"></i> ${log.distance_km} km</div>` : ''}
                ${log.max_altitude ? `<div class="flex items-center gap-1 text-slate-500"><i data-lucide="mountain" class="w-4 h-4"></i> 최고 ${log.max_altitude}m</div>` : ''}
            </div>
        `;
    } else if (log.sport === 'freediving') {
        keyMetricsHtml = `
            <div class="flex items-center gap-4 text-sm text-slate-600 bg-sky-50/70 p-2.5 rounded-lg">
                ${log.freedive_depth ? `<div class="flex items-center gap-1 font-bold text-sky-800"><i data-lucide="arrow-down-circle" class="w-4 h-4 text-sky-600"></i> 최대 ${log.freedive_depth} m</div>` : ''}
                ${log.freedive_sta ? `<div class="flex items-center gap-1"><i data-lucide="clock" class="w-4 h-4 text-sky-600"></i> STA ${log.freedive_sta}</div>` : ''}
                ${log.dive_count ? `<div class="flex items-center gap-1"><i data-lucide="rotate-ccw" class="w-4 h-4 text-sky-600"></i> ${log.dive_count}회 다이브</div>` : ''}
            </div>
        `;
    } else if (log.sport === 'other') {
        keyMetricsHtml = `
            <div class="flex items-center gap-3 text-sm text-slate-600 bg-rose-50/60 p-2.5 rounded-lg">
                ${log.discipline ? `<div class="flex items-center gap-1 font-bold text-rose-700"><i data-lucide="dumbbell" class="w-4 h-4 text-rose-500"></i> ${log.discipline}</div>` : ''}
                ${log.duration_minutes ? `<div class="flex items-center gap-1 text-slate-600"><i data-lucide="clock" class="w-4 h-4 text-slate-400"></i> ${log.duration_minutes}분</div>` : ''}
            </div>
        `;
    }

    return `
        <div class="log-card bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm hover:border-slate-300">
            <div>
                <div class="flex items-center justify-between gap-2 mb-3">
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.badgeClass}">
                            <i data-lucide="${config.icon}" class="w-3.5 h-3.5"></i>
                            ${config.name}
                        </span>
                        <span class="text-xs text-slate-400 font-medium">${log.date}</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        ${log.intensity ? `<span class="px-2 py-0.5 rounded text-xs font-bold intensity-badge-${log.intensity}">RPE ${log.intensity}</span>` : ''}
                        <div class="relative inline-block text-left">
                            <button onclick="openLogMenu(${log.id})" class="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                                <i data-lucide="more-vertical" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <h3 class="text-base font-bold text-slate-900 mb-1.5 line-clamp-1">${log.title || `${config.name} 운동`}</h3>
                
                ${log.location_course ? `
                    <p class="text-xs text-slate-500 flex items-center gap-1 mb-3">
                        <i data-lucide="compass" class="w-3.5 h-3.5 text-slate-400"></i>
                        ${log.location_course}
                    </p>
                ` : '<div class="mb-3"></div>'}

                ${keyMetricsHtml}

                ${log.notes ? `
                    <p class="text-xs text-slate-600 mt-3 line-clamp-2 bg-slate-50/50 p-2 rounded border border-slate-100">
                        ${log.notes}
                    </p>
                ` : ''}
            </div>

            <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div class="flex items-center gap-3">
                    ${log.duration_minutes ? `<span><i data-lucide="clock" class="w-3.5 h-3.5 inline mr-1 text-slate-400"></i>${log.duration_minutes}분</span>` : ''}
                    ${log.weather ? `<span><i data-lucide="sun" class="w-3.5 h-3.5 inline mr-1 text-slate-400"></i>${log.weather} ${log.temperature ? log.temperature + '°C' : ''}</span>` : ''}
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="editLog(${log.id})" class="text-indigo-600 hover:text-indigo-800 font-medium hover:underline flex items-center gap-0.5">
                        <i data-lucide="edit-3" class="w-3 h-3"></i> 수정
                    </button>
                    <button onclick="deleteLog(${log.id})" class="text-rose-600 hover:text-rose-800 font-medium hover:underline flex items-center gap-0.5 ml-2">
                        <i data-lucide="trash-2" class="w-3 h-3"></i> 삭제
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Handle Form Submission
async function handleFormSubmit(e) {
    e.preventDefault();

    const data = {
        date: document.getElementById('inputDate').value,
        sport: currentSport,
        title: document.getElementById('inputTitle').value.trim(),
        duration_minutes: parseInt(document.getElementById('inputDuration').value) || 0,
        intensity: parseInt(document.getElementById('inputIntensity').value) || 5,
        condition_note: document.getElementById('inputCondition').value.trim(),
        weather: document.getElementById('inputWeather').value,
        temperature: document.getElementById('inputTemperature').value ? parseFloat(document.getElementById('inputTemperature').value) : null,
        notes: document.getElementById('inputNotes').value.trim(),
        gear: document.getElementById('inputGear').value.trim(),

        // Running & Walking
        distance_km: document.getElementById('inputDistance').value ? parseFloat(document.getElementById('inputDistance').value) : 0,
        pace: document.getElementById('inputPace').value.trim(),
        avg_hr: document.getElementById('inputAvgHr').value ? parseInt(document.getElementById('inputAvgHr').value) : null,
        max_hr: document.getElementById('inputMaxHr').value ? parseInt(document.getElementById('inputMaxHr').value) : null,
        cadence: document.getElementById('inputCadence').value ? parseInt(document.getElementById('inputCadence').value) : null,

        // Hiking & Trail Running
        location_course: document.getElementById('inputLocation').value.trim(),
        elevation_gain: document.getElementById('inputElevation').value ? parseInt(document.getElementById('inputElevation').value) : 0,
        max_altitude: document.getElementById('inputMaxAltitude').value ? parseInt(document.getElementById('inputMaxAltitude').value) : 0,
        rest_minutes: document.getElementById('inputRestMinutes').value ? parseInt(document.getElementById('inputRestMinutes').value) : 0,
        pack_weight: document.getElementById('inputPackWeight').value ? parseFloat(document.getElementById('inputPackWeight').value) : null,
        trail_condition: document.getElementById('inputTrailCondition').value.trim(),

        // Freediving
        freedive_depth: document.getElementById('inputDiveDepth').value ? parseFloat(document.getElementById('inputDiveDepth').value) : 0,
        freedive_sta: document.getElementById('inputDiveSta').value.trim(),
        dive_count: document.getElementById('inputDiveCount').value ? parseInt(document.getElementById('inputDiveCount').value) : 0,
        water_temp: document.getElementById('inputWaterTemp').value ? parseFloat(document.getElementById('inputWaterTemp').value) : null,
        discipline: document.getElementById('inputDiscipline').value.trim(),
        // Other / Custom Sport
        discipline: (currentSport === 'other' ? document.getElementById('inputCustomSport')?.value.trim() : document.getElementById('inputDiscipline')?.value.trim()) || '',
        suit_weight: document.getElementById('inputSuitWeight')?.value.trim() || '',
        buddy: document.getElementById('inputBuddy')?.value.trim() || ''
    };

    if (currentSport === 'other') {
        const customName = document.getElementById('inputCustomSport')?.value.trim();
        const customLoc = document.getElementById('inputLocationOther')?.value.trim();
        if (customLoc) data.location_course = customLoc;
        if (!data.title) {
            data.title = customName ? `${customName} 운동` : `기타 운동 (${data.date})`;
        }
    } else if (!data.title) {
        data.title = `${SPORT_CONFIG[currentSport].name} 기록 (${data.date})`;
    }

    try {
        if (editingLogId) {
            await API.updateLog(editingLogId, data);
            showToast('운동 기록이 성공적으로 수정되었습니다!', 'success');
        } else {
            await API.createLog(data);
            showToast('새 운동 기록이 저장되었습니다!', 'success');
        }
        resetForm();
        switchMainView('list');
        loadDashboardAndLogs();
    } catch (err) {
        console.error(err);
        showToast(err.message, 'error');
    }
}

// Edit Log
async function editLog(id) {
    try {
        const log = await API.getLogDetail(id);
        if (!log) return;

        editingLogId = id;
        setFormSport(log.sport);

        // Fill form fields
        document.getElementById('inputDate').value = log.date || '';
        document.getElementById('inputTitle').value = log.title || '';
        document.getElementById('inputDuration').value = log.duration_minutes || '';
        document.getElementById('inputIntensity').value = log.intensity || 5;
        document.getElementById('intensityValue').textContent = `${log.intensity || 5} / 10`;
        document.getElementById('inputCondition').value = log.condition_note || '';
        document.getElementById('inputWeather').value = log.weather || '맑음';
        document.getElementById('inputTemperature').value = log.temperature || '';
        document.getElementById('inputNotes').value = log.notes || '';
        document.getElementById('inputGear').value = log.gear || '';

        // Running / Walking
        document.getElementById('inputDistance').value = log.distance_km || '';
        document.getElementById('inputPace').value = log.pace || '';
        document.getElementById('inputAvgHr').value = log.avg_hr || '';
        document.getElementById('inputMaxHr').value = log.max_hr || '';
        document.getElementById('inputCadence').value = log.cadence || '';

        // Hiking / Trail Running
        document.getElementById('inputLocation').value = log.location_course || '';
        document.getElementById('inputElevation').value = log.elevation_gain || '';
        document.getElementById('inputMaxAltitude').value = log.max_altitude || '';
        document.getElementById('inputRestMinutes').value = log.rest_minutes || '';
        document.getElementById('inputPackWeight').value = log.pack_weight || '';
        document.getElementById('inputTrailCondition').value = log.trail_condition || '';

        // Freediving
        document.getElementById('inputDiveDepth').value = log.freedive_depth || '';
        document.getElementById('inputDiveSta').value = log.freedive_sta || '';
        document.getElementById('inputDiveCount').value = log.dive_count || '';
        document.getElementById('inputWaterTemp').value = log.water_temp || '';
        document.getElementById('inputDiscipline').value = log.discipline || 'CWT';
        document.getElementById('inputSuitWeight').value = log.suit_weight || '';
        document.getElementById('inputBuddy').value = log.buddy || '';

        // Other
        if (document.getElementById('inputCustomSport')) {
            document.getElementById('inputCustomSport').value = log.discipline || '';
        }
        if (document.getElementById('inputLocationOther')) {
            document.getElementById('inputLocationOther').value = log.location_course || '';
        }

        // Form Title & Buttons
        document.getElementById('formHeaderTitle').textContent = '운동 기록 수정';
        document.getElementById('submitBtnText').textContent = '수정사항 저장';
        document.getElementById('cancelEditBtn').classList.remove('hidden');

        switchMainView('new');
    } catch (err) {
        console.error(err);
        showToast(err.message, 'error');
    }
}

// Delete Log
async function deleteLog(id) {
    if (!confirm('정말로 이 운동 기록을 삭제하시겠습니까?')) return;
    try {
        await API.deleteLog(id);
        showToast('운동 기록이 삭제되었습니다.', 'info');
        loadDashboardAndLogs();
    } catch (err) {
        console.error(err);
        showToast(err.message, 'error');
    }
}

// Reset Form
function resetForm() {
    editingLogId = null;
    document.getElementById('workoutForm').reset();
    initDefaultDate();
    document.getElementById('intensityValue').textContent = '5 / 10';
    document.getElementById('formHeaderTitle').textContent = '새 운동 기록하기';
    document.getElementById('submitBtnText').textContent = '운동 기록 저장하기';
    document.getElementById('cancelEditBtn').classList.add('hidden');
    setFormSport('running');
}

// Export Data to JSON
async function handleExport() {
    try {
        const data = await API.exportData();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchor = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `workout_backup_${dateStr}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast('운동 데이터 백업 파일이 다운로드되었습니다.', 'success');
    } catch (err) {
        console.error(err);
        showToast(err.message, 'error');
    }
}

// Import Data from JSON
function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const json = JSON.parse(event.target.result);
            const res = await API.importData(json);
            showToast(`${res.imported_count}개의 운동 기록을 성공적으로 가져왔습니다!`, 'success');
            loadDashboardAndLogs();
            e.target.value = '';
        } catch (err) {
            console.error(err);
            showToast('올바른 JSON 백업 파일 형식이 아닙니다.', 'error');
        }
    };
    reader.readAsText(file);
}

// Toast Notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;

    if (type === 'success') {
        toast.className = 'fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg transition duration-300 transform translate-y-0 opacity-100';
        toastIcon.setAttribute('data-lucide', 'check-circle-2');
    } else if (type === 'error') {
        toast.className = 'fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-rose-600 text-white px-4 py-3 rounded-xl shadow-lg transition duration-300 transform translate-y-0 opacity-100';
        toastIcon.setAttribute('data-lucide', 'alert-circle');
    } else {
        toast.className = 'fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-slate-800 text-white px-4 py-3 rounded-xl shadow-lg transition duration-300 transform translate-y-0 opacity-100';
        toastIcon.setAttribute('data-lucide', 'info');
    }

    lucide.createIcons();

    setTimeout(() => {
        toast.className = 'fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg transition duration-300 transform translate-y-10 opacity-0 pointer-events-none';
    }, 3200);
}

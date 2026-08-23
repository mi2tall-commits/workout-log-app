// Charts Module using Chart.js
let activityChart = null;
let mileageChart = null;
let elevationChart = null;
let freedivingChart = null;

const SPORT_COLORS = {
    running: { bg: 'rgba(234, 88, 12, 0.7)', border: '#ea580c', label: '런닝' },
    hiking: { bg: 'rgba(22, 163, 74, 0.7)', border: '#16a34a', label: '등산' },
    trail_running: { bg: 'rgba(13, 148, 136, 0.7)', border: '#0d9488', label: '트레일런닝' },
    freediving: { bg: 'rgba(2, 132, 199, 0.7)', border: '#0284c7', label: '프리다이빙' },
    walking: { bg: 'rgba(147, 51, 234, 0.7)', border: '#9333ea', label: '걷기' },
    other: { bg: 'rgba(225, 29, 72, 0.7)', border: '#e11d48', label: '기타' }
};

const ChartsManager = {
    renderCharts(monthlyTrends, logs) {
        this.renderActivityCountChart(monthlyTrends);
        this.renderMileageChart(logs);
        this.renderElevationChart(logs);
        this.renderFreedivingChart(logs);
    },

    // 1. Monthly Activity Frequency
    renderActivityCountChart(trends) {
        const ctx = document.getElementById('activityChart');
        if (!ctx) return;

        if (activityChart) activityChart.destroy();

        // Extract unique months
        const months = [...new Set(trends.map(t => t.month))].sort();
        if (months.length === 0) return;

        const sports = ['running', 'hiking', 'trail_running', 'freediving', 'walking', 'other'];
        const datasets = sports.map(sport => {
            const data = months.map(m => {
                const found = trends.find(t => t.month === m && t.sport === sport);
                return found ? found.count : 0;
            });
            return {
                label: SPORT_COLORS[sport]?.label || sport,
                data: data,
                backgroundColor: SPORT_COLORS[sport]?.bg || 'rgba(100, 116, 139, 0.7)',
                borderColor: SPORT_COLORS[sport]?.border || '#64748b',
                borderWidth: 1,
                borderRadius: 4
            };
        });

        activityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Pretendard' } } },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    },

    // 2. Running & Walking Distance Progression
    renderMileageChart(logs) {
        const ctx = document.getElementById('mileageChart');
        if (!ctx) return;

        if (mileageChart) mileageChart.destroy();

        const runWalkLogs = logs
            .filter(l => (l.sport === 'running' || l.sport === 'walking' || l.sport === 'trail_running') && l.distance_km > 0)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const labels = runWalkLogs.map(l => l.date);
        const data = runWalkLogs.map(l => l.distance_km);
        const pointColors = runWalkLogs.map(l => SPORT_COLORS[l.sport]?.border || '#ea580c');

        mileageChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '거리 (km)',
                    data: data,
                    borderColor: '#ea580c',
                    backgroundColor: 'rgba(234, 88, 12, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: pointColors,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.parsed.y} km`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: '거리 (km)' }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    },

    // 3. Hiking & Trail Running Elevation Gain
    renderElevationChart(logs) {
        const ctx = document.getElementById('elevationChart');
        if (!ctx) return;

        if (elevationChart) elevationChart.destroy();

        const hikeLogs = logs
            .filter(l => (l.sport === 'hiking' || l.sport === 'trail_running') && l.elevation_gain > 0)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const labels = hikeLogs.map(l => `${l.date} (${l.location_course || l.title || '산행'})`);
        const data = hikeLogs.map(l => l.elevation_gain);
        const barColors = hikeLogs.map(l => SPORT_COLORS[l.sport]?.bg || 'rgba(22, 163, 74, 0.7)');

        elevationChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '누적 상승고도 (m)',
                    data: data,
                    backgroundColor: barColors,
                    borderColor: '#16a34a',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `상승고도: +${ctx.parsed.y} m`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: '누적 상승고도 (m)' }
                    },
                    x: {
                        ticks: {
                            callback: function(val, index) {
                                const full = this.getLabelForValue(val);
                                return full.split(' ')[0]; // Show date only on axis
                            }
                        },
                        grid: { display: false }
                    }
                }
            }
        });
    },

    // 4. Freediving Depth Progression
    renderFreedivingChart(logs) {
        const ctx = document.getElementById('freedivingChart');
        if (!ctx) return;

        if (freedivingChart) freedivingChart.destroy();

        const freediveLogs = logs
            .filter(l => l.sport === 'freediving' && l.freedive_depth > 0)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const labels = freediveLogs.map(l => `${l.date} (${l.location_course || '다이빙'})`);
        const data = freediveLogs.map(l => l.freedive_depth);

        freedivingChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '최대 수심 (m)',
                    data: data,
                    borderColor: '#0284c7',
                    backgroundColor: 'rgba(2, 132, 199, 0.15)',
                    fill: true,
                    tension: 0.2,
                    pointBackgroundColor: '#0284c7',
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `최대 수심: ${ctx.parsed.y} m`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: '수심 (m)' }
                    },
                    x: {
                        ticks: {
                            callback: function(val) {
                                const full = this.getLabelForValue(val);
                                return full.split(' ')[0];
                            }
                        },
                        grid: { display: false }
                    }
                }
            }
        });
    }
};

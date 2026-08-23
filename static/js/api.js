// API Service for Workout Log App
const API = {
    baseUrl: '/api',

    async getLogs(params = {}) {
        const query = new URLSearchParams();
        if (params.sport && params.sport !== 'all') query.append('sport', params.sport);
        if (params.search) query.append('search', params.search);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);

        const url = `${this.baseUrl}/logs?${query.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('기록 목록을 불러오는데 실패했습니다.');
        return await res.json();
    },

    async getLogDetail(id) {
        const res = await fetch(`${this.baseUrl}/logs/${id}`);
        if (!res.ok) throw new Error('상세 기록을 불러오는데 실패했습니다.');
        return await res.json();
    },

    async createLog(data) {
        const res = await fetch(`${this.baseUrl}/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || '운동 기록 저장에 실패했습니다.');
        }
        return await res.json();
    },

    async updateLog(id, data) {
        const res = await fetch(`${this.baseUrl}/logs/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || '운동 기록 수정에 실패했습니다.');
        }
        return await res.json();
    },

    async deleteLog(id) {
        const res = await fetch(`${this.baseUrl}/logs/${id}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('운동 기록 삭제에 실패했습니다.');
        return await res.json();
    },

    async getStats() {
        const res = await fetch(`${this.baseUrl}/stats`);
        if (!res.ok) throw new Error('통계 데이터를 불러오는데 실패했습니다.');
        return await res.json();
    },

    async exportData() {
        const res = await fetch(`${this.baseUrl}/export`);
        if (!res.ok) throw new Error('데이터 내보내기에 실패했습니다.');
        return await res.json();
    },

    async importData(data) {
        const res = await fetch(`${this.baseUrl}/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || '데이터 가져오기에 실패했습니다.');
        }
        return await res.json();
    }
};

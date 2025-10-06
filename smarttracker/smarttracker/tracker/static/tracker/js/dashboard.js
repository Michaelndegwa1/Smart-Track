// Smart Time Track Dashboard JavaScript

class SmartTimeTracker {
    constructor() {
        this.colors = {
            facebook: '#3b82f6',
            instagram: '#ec4899',
            x: '#111827',
            tiktok: '#10b981'
        };
        this.targetHours = 4.0;
        this.charts = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInitialData();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        // Tab switching
        const tabs = document.querySelectorAll('.tab-btn');
        const sections = {
            tracker: document.getElementById('tab-tracker'),
            gpa: document.getElementById('tab-gpa'),
            analysis: document.getElementById('tab-analysis')
        };

        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                tabs.forEach(b => b.classList.remove('tab-active'));
                btn.classList.add('tab-active');
                Object.values(sections).forEach(s => s.classList.add('hidden'));
                sections[btn.dataset.tab].classList.remove('hidden');
            });
        });

        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshTrackerData());
        }

        // GPA Calculator
        this.setupGPACalculator();

        // Analysis
        this.setupAnalysis();
    }

    setupGPACalculator() {
        const addRowBtn = document.getElementById('addRow');
        const clearRowsBtn = document.getElementById('clearRows');
        const calcBtn = document.getElementById('calc');

        if (addRowBtn) {
            addRowBtn.addEventListener('click', () => this.addGPARow());
        }

        if (clearRowsBtn) {
            clearRowsBtn.addEventListener('click', () => this.clearGPARows());
        }

        if (calcBtn) {
            calcBtn.addEventListener('click', () => this.calculateGPA());
        }

        // Add initial sample rows
        this.addGPARow('Math', 3, 'A');
        this.addGPARow('English', 3, 'B+');
        this.addGPARow('History', 2, 'A-');
        this.addGPARow('CRE', 3, 'A');
        this.addGPARow('SSC', 3.5, 'A+');
    }

    setupAnalysis() {
        const runAnalysisBtn = document.getElementById('runAnalysis');
        if (runAnalysisBtn) {
            runAnalysisBtn.addEventListener('click', () => this.runAnalysis());
        }
    }

    async fetchJSON(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }

    async loadInitialData() {
        try {
            await this.refreshTrackerData();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError('Failed to load initial data');
        }
    }

    async refreshTrackerData() {
        try {
            await Promise.all([
                this.loadKPIs(),
                this.loadDonuts(),
                this.loadDonutTotal(),
                this.loadChart(),
                this.loadSessions()
            ]);
        } catch (error) {
            console.error('Error refreshing tracker data:', error);
            this.showError('Failed to refresh data');
        }
    }

    async loadKPIs() {
        const data = await this.fetchJSON('/summary/today/');
        const totals = data.totals || {};
        
        document.getElementById('kpi_fb').textContent = Math.round(totals.facebook || 0);
        document.getElementById('kpi_ig').textContent = Math.round(totals.instagram || 0);
        document.getElementById('kpi_x').textContent = Math.round(totals.x || 0);
        document.getElementById('kpi_tt').textContent = Math.round(totals.tiktok || 0);
    }

    async loadDonuts() {
        const avg = await this.fetchJSON('/summary/avg_hours_per_day/');
        
        const platforms = ['fb', 'ig', 'x', 'tt'];
        const platformNames = ['facebook', 'instagram', 'x', 'tiktok'];
        
        platforms.forEach((platform, index) => {
            const canvasId = `d_${platform}`;
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            const value = avg[platformNames[index]] || 0;
            const color = this.colors[platformNames[index]];
            
            // Destroy existing chart
            if (this.charts[canvasId]) {
                this.charts[canvasId].destroy();
            }
            
            this.charts[canvasId] = new Chart(ctx, this.createDonutConfig(value, color));
        });
    }

    createDonutConfig(value, color) {
        return {
            type: 'doughnut',
            data: {
                labels: ['Used', 'Remaining'],
                datasets: [{
                    data: [
                        Math.min(value, this.targetHours),
                        Math.max(this.targetHours - Math.min(value, this.targetHours), 0.0001)
                    ],
                    backgroundColor: [color, '#e5e7eb'],
                    borderWidth: 0
                }]
            },
            options: {
                cutout: '70%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                if (context.dataIndex === 0) {
                                    return `Used: ${value.toFixed(2)} h/day`;
                                }
                                return `Target: ${this.targetHours} h/day`;
                            }
                        }
                    }
                }
            },
            plugins: [{
                id: 'centerText',
                afterDraw: (chart) => {
                    const { ctx } = chart;
                    const meta = chart.getDatasetMeta(0).data[0];
                    if (!meta) return;
                    
                    ctx.save();
                    ctx.font = 'bold 16px system-ui';
                    ctx.fillStyle = '#111827';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`${value.toFixed(2)}h`, meta.x, meta.y);
                    ctx.restore();
                }
            }]
        };
    }

    async loadDonutTotal() {
        const data = await this.fetchJSON('/summary/total_all/');
        const totals = data.totals_sec || {};
        
        const labels = ['facebook', 'instagram', 'x', 'tiktok'];
        const values = labels.map(k => Math.round(totals[k] || 0));
        const colors = labels.map(k => this.colors[k]);
        const totalSec = values.reduce((a, b) => a + b, 0);
        const totalHours = (totalSec / 3600).toFixed(2);
        
        const canvas = document.getElementById('donutTotal');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart
        if (this.charts.donutTotal) {
            this.charts.donutTotal.destroy();
        }
        
        this.charts.donutTotal = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels.map(s => s[0].toUpperCase() + s.slice(1)),
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 0
                }]
            },
            options: {
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#0f172a' }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const sec = context.raw || 0;
                                const ms = Math.round(sec * 1000);
                                const hours = (sec / 3600).toFixed(2);
                                return `${context.label}: ${sec.toLocaleString()} s (${ms.toLocaleString()} ms, ${hours} h)`;
                            }
                        }
                    }
                }
            },
            plugins: [{
                id: 'centerTotalText',
                afterDraw: (chart) => {
                    const { ctx } = chart;
                    const meta = chart.getDatasetMeta(0).data[0];
                    if (!meta) return;
                    
                    ctx.save();
                    ctx.font = 'bold 18px system-ui';
                    ctx.fillStyle = '#111827';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`${totalHours} h`, meta.x, meta.y);
                    ctx.font = '12px system-ui';
                    ctx.fillStyle = '#6b7280';
                    ctx.fillText('total', meta.x, meta.y + 18);
                    ctx.restore();
                }
            }]
        });
        
        // Update breakdown
        const breakdown = document.getElementById('totalBreakdown');
        if (breakdown) {
            breakdown.innerHTML = labels.map(k => {
                const sec = Math.round(totals[k] || 0);
                const ms = Math.round(sec * 1000);
                const hours = (sec / 3600).toFixed(2);
                const name = k[0].toUpperCase() + k.slice(1);
                return `<div><span class="font-semibold">${name}:</span> ${sec.toLocaleString()} s (${ms.toLocaleString()} ms, ${hours} h)</div>`;
            }).join('');
        }
    }

    async loadChart() {
        const data = await this.fetchJSON('/summary/last7/');
        const config = this.prepareLast7Data(data);
        
        const canvas = document.getElementById('chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart
        if (this.charts.last7) {
            this.charts.last7.destroy();
        }
        
        this.charts.last7 = new Chart(ctx, {
            type: 'bar',
            data: config,
            options: {
                responsive: true,
                scales: {
                    x: { stacked: true },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Seconds'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#0f172a' }
                    }
                }
            }
        });
    }

    prepareLast7Data(data) {
        const days = [...new Set(data.map(d => d.date))].sort();
        const platforms = ['facebook', 'instagram', 'x', 'tiktok'];
        
        const datasets = platforms.map(platform => ({
            label: platform,
            data: days.map(day => {
                const row = data.find(d => d.date === day && d.platform === platform);
                return row ? Math.round(row.seconds) : 0;
            }),
            backgroundColor: this.colors[platform],
            borderColor: this.colors[platform],
            borderWidth: 1
        }));
        
        return { labels: days, datasets };
    }

    async loadSessions() {
        const sessions = await this.fetchJSON('/sessions/recent/?limit=10');
        const tbody = document.getElementById('tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        sessions.forEach(session => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="py-1 pr-4">${session.id}</td>
                <td class="py-1 pr-4 capitalize">${session.platform}</td>
                <td class="py-1 pr-4">${Math.round(session.time)}</td>
                <td class="py-1 pr-4">${session.start_ts}</td>
                <td class="py-1 pr-4">${session.end_ts}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // GPA Calculator methods
    addGPARow(name = '', credits = '', grade = 'A') {
        const rowsEl = document.getElementById('rows');
        if (!rowsEl) return;
        
        const gradeOptions = this.getGradeOptions();
        const rowHTML = `
            <div class="grid grid-cols-12 gap-2 items-center">
                <input class="col-span-6 border border-neutral-300 rounded-lg px-3 py-2 text-black" 
                       placeholder="Course (optional)" value="${name}">
                <input class="col-span-3 border border-neutral-300 rounded-lg px-3 py-2 text-black" 
                       placeholder="Credits" type="number" step="0.5" min="0.5" value="${credits}">
                <select class="col-span-2 border border-neutral-300 rounded-lg px-3 py-2 text-black">
                    ${gradeOptions}
                </select>
                <button class="col-span-1 text-red-600 hover:text-red-700 text-xl leading-none" 
                        title="Remove" type="button">✕</button>
            </div>
        `;
        
        const wrap = document.createElement('div');
        wrap.innerHTML = rowHTML;
        const row = wrap.firstElementChild;
        
        // Set grade value
        const gradeSelect = row.querySelector('select');
        gradeSelect.value = grade;
        
        // Add remove functionality
        const removeBtn = row.querySelector('button');
        removeBtn.addEventListener('click', () => row.remove());
        
        rowsEl.appendChild(row);
    }

    getGradeOptions() {
        const grades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
        return grades.map(grade => `<option value="${grade}">${grade}</option>`).join('');
    }

    clearGPARows() {
        const rowsEl = document.getElementById('rows');
        if (rowsEl) {
            rowsEl.innerHTML = '';
        }
    }

    readGPACourses() {
        const rowsEl = document.getElementById('rows');
        if (!rowsEl) return [];
        
        return [...rowsEl.children].map(row => {
            const [nameEl, credEl, gradeEl] = row.children;
            return {
                name: nameEl.value.trim(),
                credits: Number(credEl.value || 0),
                grade: gradeEl.value
            };
        }).filter(course => course.credits > 0);
    }

    async calculateGPA() {
        try {
            const courses = this.readGPACourses();
            const payload = {
                courses: courses,
                custom_scale: null
            };
            
            const response = await fetch('/api/calc/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            this.renderGPAReport(data);
        } catch (error) {
            console.error('Error calculating GPA:', error);
            this.showError('Failed to calculate GPA');
        }
    }

    renderGPAReport(data) {
        const reportEl = document.getElementById('report');
        const gpaCell = document.getElementById('gpaCell');
        const kpiG = document.getElementById('kpi_gpa');
        const tot = document.getElementById('tot');
        
        if (reportEl) {
            reportEl.innerHTML = '';
            data.rows.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="p-2 text-black">${row.name}</td>
                    <td class="p-2 text-black">${row.credits}</td>
                    <td class="p-2 text-black">${row.grade}</td>
                    <td class="p-2 text-black">${row.explain}</td>
                `;
                reportEl.appendChild(tr);
            });
        }
        
        if (gpaCell) gpaCell.textContent = data.gpa.toFixed(3);
        if (kpiG) kpiG.textContent = 'GPA: ' + data.gpa.toFixed(3);
        if (tot) tot.textContent = 'Total Credits: ' + data.total_credits;
    }

    // Analysis methods
    async runAnalysis() {
        try {
            const catWeight = Number(document.getElementById('catW').value || 0.4);
            const examWeight = Number(document.getElementById('examW').value || 0.6);
            const output = document.getElementById('analysisOut');
            
            if (output) {
                output.innerHTML = 'Running analysis...';
            }
            
            const response = await fetch(`/api/analysis/run/?cat=${catWeight}&exam=${examWeight}`);
            const data = await response.json();
            
            if (!response.ok) {
                if (output) {
                    output.textContent = data.error || 'Error';
                }
                return;
            }
            
            this.renderAnalysisResults(data, output);
        } catch (error) {
            console.error('Error running analysis:', error);
            this.showError('Failed to run analysis');
        }
    }

    renderAnalysisResults(data, output) {
        let html = '';
        
        // GPA by semester
        const gpaList = data.gpa_by_semester.map(x => 
            `<div><b>${x.semester_id}</b>: GPA ${x.gpa} <span class="text-slate-500">(${x.start} → ${x.end})</span></div>`
        ).join('');
        
        html += `<div class="font-semibold mb-1" style="color:var(--blue)">GPA by Semester</div>${gpaList}<hr class="my-2">`;
        
        // Semesters with recommendations
        data.semesters.forEach(semester => {
            const chips = Object.entries(semester.avg_hours_per_day)
                .map(([k, v]) => `<span class="chip mr-2 mb-2 inline-block">${k}: ${v.toFixed(2)} h/day</span>`)
                .join(' ');
            
            const recs = semester.recommendations
                .map(x => `<li class="mb-1">${x}</li>`)
                .join('');
            
            html += `
                <div class="mb-4 border border-slate-200 rounded-xl p-3">
                    <div class="font-semibold" style="color:var(--blue)">
                        Semester ${semester.semester_id} — GPA ${semester.gpa} 
                        <span class="text-slate-500">(${semester.start} → ${semester.end}, days seen: ${semester.days_seen})</span>
                    </div>
                    <div class="mt-2">${chips}</div>
                    <div class="mt-3 font-semibold" style="color:var(--gold)">Decision & Recommendations</div>
                    <ul class="list-disc pl-6">${recs}</ul>
                </div>
            `;
        });
        
        if (data.note) {
            html += `<div class="text-slate-500 mt-2">${data.note}</div>`;
        }
        
        if (output) {
            output.innerHTML = html;
        }
    }

    // Utility methods
    getCSRFToken() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') {
                return value;
            }
        }
        return '';
    }

    showError(message) {
        // Create a simple error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-error';
        errorDiv.textContent = message;
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '20px';
        errorDiv.style.right = '20px';
        errorDiv.style.zIndex = '1000';
        
        document.body.appendChild(errorDiv);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    startAutoRefresh() {
        // Refresh data every 10 seconds
        setInterval(() => {
            this.refreshTrackerData();
        }, 10000);
    }
}

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SmartTimeTracker();
});
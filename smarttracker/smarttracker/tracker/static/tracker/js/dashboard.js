const COLORS = { facebook:'#3b82f6', instagram:'#ec4899', x:'#111827', tiktok:'#10b981' };
const fmt = n => Math.round(n || 0);

async function fetchJSON(url){ const r = await fetch(url); return r.json(); }

async function loadKPIs(){
  const data = await fetchJSON('/api/summary/today/');
  const t = data.totals || {};
  document.getElementById('kpi_fb').textContent = fmt(t.facebook);
  document.getElementById('kpi_ig').textContent = fmt(t.instagram);
  document.getElementById('kpi_x').textContent = fmt(t.x);
  document.getElementById('kpi_tt').textContent = fmt(t.tiktok);
}

function donutConfig(value, color){
  return {
    type:'doughnut',
    data:{ labels:['Used','Remaining'],
      datasets:[{ data:[Math.min(value,4), Math.max(4-value,0.1)], backgroundColor:[color,'#e5e7eb'], borderWidth:0 }]
    },
    options:{ cutout:'70%', plugins:{ legend:{display:false} } }
  };
}

let d_fb, d_ig, d_x, d_tt;
async function loadDonuts(){
  const avg = await fetchJSON('/api/summary/avg_hours_per_day/');
  if(d_fb)d_fb.destroy(); if(d_ig)d_ig.destroy(); if(d_x)d_x.destroy(); if(d_tt)d_tt.destroy();
  d_fb = new Chart(document.getElementById('d_fb'), donutConfig(avg.facebook, COLORS.facebook));
  d_ig = new Chart(document.getElementById('d_ig'), donutConfig(avg.instagram, COLORS.instagram));
  d_x  = new Chart(document.getElementById('d_x'),  donutConfig(avg.x, COLORS.x));
  d_tt = new Chart(document.getElementById('d_tt'), donutConfig(avg.tiktok, COLORS.tiktok));
}

let donutTotal;
async function loadDonutTotal(){
  const data = await fetchJSON('/api/summary/total_all/');
  const t = data.totals_sec || {};
  const labels = ['facebook','instagram','x','tiktok'];
  const values = labels.map(k=>Math.round(t[k]||0));
  const ctx = document.getElementById('donutTotal');
  if(donutTotal)donutTotal.destroy();
  donutTotal = new Chart(ctx, {
    type:'doughnut',
    data:{ labels, datasets:[{ data:values, backgroundColor:labels.map(k=>COLORS[k]), borderWidth:0 }] },
    options:{ plugins:{ legend:{ position:'bottom', labels:{ color:'#111' } } } }
  });
  const totalSec = values.reduce((a,b)=>a+b,0);
  const totalHours = (totalSec/3600).toFixed(2);
  document.getElementById('totalBreakdown').innerHTML = labels.map(k=>{
    const sec=t[k]||0, h=(sec/3600).toFixed(2);
    return `<div><b>${k}:</b> ${sec.toLocaleString()} s (${h} h)</div>`;
  }).join('');
}

let chart;
async function loadChart(){
  const data = await fetchJSON('/api/summary/last7/');
  const days=[...new Set(data.map(d=>d.date))].sort();
  const plats=['facebook','instagram','x','tiktok'];
  const datasets = plats.map(p=>({
    label:p, data:days.map(day=>{
      const r=data.find(d=>d.date===day && d.platform===p);
      return r?Math.round(r.seconds):0;
    }),
    backgroundColor:COLORS[p]
  }));
  if(chart)chart.destroy();
  chart=new Chart(document.getElementById('chart'),{ type:'bar', data:{ labels:days, datasets }, options:{ scales:{y:{beginAtZero:true}}}});
}

async function loadSessions(){
  const rows = await fetchJSON('/api/sessions/recent/?limit=10');
  const tbody=document.getElementById('tbody'); tbody.innerHTML='';
  for(const r of rows){
    const tr=document.createElement('tr');
    tr.innerHTML=`<td class="py-1 pr-4">${r.id}</td>
                  <td class="py-1 pr-4 capitalize">${r.platform}</td>
                  <td class="py-1 pr-4">${fmt(r.time)}</td>
                  <td class="py-1 pr-4">${r.start_ts}</td>
                  <td class="py-1 pr-4">${r.end_ts}</td>`;
    tbody.appendChild(tr);
  }
}

async function refreshAll(){
  await Promise.all([loadKPIs(), loadDonuts(), loadDonutTotal(), loadChart(), loadSessions()]);
}

document.getElementById('refreshBtn').addEventListener('click', refreshAll);
refreshAll(); setInterval(refreshAll, 10000);

// Report webview client-side logic
const vscode = acquireVsCodeApi();

document.getElementById('start-quiz-btn').addEventListener('click', () => {
  vscode.postMessage({ type: 'openFile', data: { command: 'vibeaudit.startQuiz' } });
});

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

function scoreColor(score) {
  if (score >= 81) return 'var(--vscode-charts-blue, #75beff)';
  if (score >= 61) return 'var(--vscode-charts-green, #89d185)';
  if (score >= 31) return 'var(--vscode-charts-yellow, #cca700)';
  return 'var(--vscode-charts-red, #f14c4c)';
}

function scoreLabel(score) {
  if (score >= 81) return 'Deep — you own this codebase';
  if (score >= 61) return 'Solid — some blind spots remain';
  if (score >= 31) return 'Partial — dangerous gaps exist';
  return 'Critical — flying blind';
}

function renderBar(label, score, clickHandler) {
  const div = document.createElement('div');
  div.className = 'bar-row';
  div.innerHTML = `
    <div class="bar-label" title="${label}">${label}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${score}%;background:${scoreColor(score)}"></div></div>
    <div class="bar-pct">${score}%</div>`;
  if (clickHandler) div.style.cursor = 'pointer', div.addEventListener('click', clickHandler);
  return div;
}

function renderTimeline(timeline) {
  const el = document.getElementById('timeline-chart');
  if (!timeline || timeline.length === 0) {
    el.innerHTML = '<p style="opacity:0.5">No quiz sessions yet.</p>';
    return;
  }

  const W = 560, H = 180, PAD = 40;
  const scores = timeline.map(p => p.score);
  const minS = Math.min(0, ...scores);
  const maxS = Math.max(100, ...scores);
  const xs = timeline.map((_, i) => PAD + (i / Math.max(timeline.length - 1, 1)) * (W - PAD * 2));
  const ys = scores.map(s => H - PAD - ((s - minS) / (maxS - minS)) * (H - PAD * 2));

  const points = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const dates = timeline.map(p => new Date(p.timestamp).toLocaleDateString());

  el.innerHTML = `<svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible">
    <polyline points="${points}" fill="none" stroke="var(--vscode-button-background)" stroke-width="2"/>
    ${xs.map((x, i) => `
      <circle cx="${x}" cy="${ys[i]}" r="4" fill="var(--vscode-button-background)"/>
      <text x="${x}" y="${H - 8}" text-anchor="middle" font-size="10" opacity="0.5">${dates[i]}</text>
      <text x="${x}" y="${ys[i] - 8}" text-anchor="middle" font-size="11">${scores[i]}%</text>
    `).join('')}
  </svg>`;
}

function renderHistory(sessions) {
  const container = document.getElementById('history-list');
  if (!sessions || sessions.length === 0) {
    container.innerHTML = '<p style="opacity:0.5">No quiz sessions yet.</p>';
    return;
  }
  const sorted = [...sessions].sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
  container.innerHTML = sorted.map((s, si) => {
    const date = s.startTime ? new Date(s.startTime).toLocaleString() : 'Unknown date';
    const correct = (s.answers || []).filter(a => a.isCorrect).length;
    const total = (s.answers || []).length;
    const qRows = (s.questions || []).map((q) => {
      const ans = (s.answers || []).find(a => a.questionId === q.id);
      const userOpt = ans ? q.options.find(o => o.label === ans.selectedLabel) : null;
      const correctOpt = q.options.find(o => o.isCorrect);
      const icon = ans?.isCorrect
        ? '<span style="color:var(--vscode-charts-green,#89d185)">&#10003;</span>'
        : '<span style="color:var(--vscode-charts-red,#f14c4c)">&#10007;</span>';
      return `<div style="padding:8px 0;border-bottom:1px solid rgba(127,127,127,0.1)">
        <div style="font-size:13px;margin-bottom:4px">${icon} ${q.question}</div>
        <div style="font-size:12px;opacity:0.6">Your answer: ${userOpt ? userOpt.text : '—'}</div>
        ${!ans?.isCorrect ? `<div style="font-size:12px;color:var(--vscode-charts-green,#89d185)">Correct: ${correctOpt ? correctOpt.text : '—'}</div>` : ''}
        ${ans?.feedback ? `<div style="font-size:12px;opacity:0.7;margin-top:4px">${ans.feedback}</div>` : ''}
      </div>`;
    }).join('');
    return `<details style="margin-bottom:12px;border:1px solid rgba(127,127,127,0.2);border-radius:6px;padding:12px">
      <summary style="cursor:pointer;font-size:14px;font-weight:500">
        Session ${sorted.length - si} &mdash; ${date} &nbsp; <span style="opacity:0.7">${s.score ?? 0}% (${correct}/${total})</span>
      </summary>
      <div style="margin-top:12px">${qRows || '<p style="opacity:0.5">No question data.</p>'}</div>
    </details>`;
  }).join('');
}

function renderTeam(teamImports) {
  const container = document.getElementById('team-list');
  if (!teamImports || teamImports.length === 0) {
    container.innerHTML = '<p style="opacity:0.5">Import teammate score files to compare. Use &quot;VibeAudit: Import Team Scores&quot;.</p>';
    return;
  }
  container.innerHTML = teamImports.map(t => {
    const date = new Date(t.exportedAt).toLocaleDateString();
    const color = t.overallScore >= 81 ? 'var(--vscode-charts-blue,#75beff)'
      : t.overallScore >= 61 ? 'var(--vscode-charts-green,#89d185)'
      : t.overallScore >= 31 ? 'var(--vscode-charts-yellow,#cca700)'
      : 'var(--vscode-charts-red,#f14c4c)';
    const catRows = (t.categoryScores || []).map(c =>
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="width:120px;font-size:12px">${c.category}</span>
        <div style="flex:1;height:8px;background:rgba(127,127,127,0.15);border-radius:4px;overflow:hidden">
          <div style="width:${c.score}%;height:100%;background:${color};border-radius:4px"></div>
        </div>
        <span style="font-size:12px;opacity:0.7;width:32px;text-align:right">${c.score}%</span>
      </div>`
    ).join('');
    return `<div style="border:1px solid rgba(127,127,127,0.2);border-radius:6px;padding:14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-weight:500">${t.exportedBy || 'Teammate'}</span>
        <span style="font-size:28px;font-weight:700;color:${color}">${t.overallScore}%</span>
      </div>
      <div style="font-size:12px;opacity:0.5;margin-bottom:10px">${t.sessionCount} sessions &middot; exported ${date}</div>
      ${catRows}
    </div>`;
  }).join('');
}

window.addEventListener('message', e => {
  const msg = e.data;
  if (msg.type !== 'showReport') return;
  const data = msg.data;

  // Overall score
  const score = data.overallScore ?? 0;
  document.getElementById('overall-score').textContent = score + '%';
  document.getElementById('overall-score').style.color = scoreColor(score);
  document.getElementById('score-label').textContent = scoreLabel(score);

  // Animated ring
  const ring = document.getElementById('score-ring');
  ring.style.stroke = scoreColor(score);
  const circumference = 377;
  const offset = circumference - (score / 100) * circumference;
  setTimeout(() => { ring.style.strokeDashoffset = offset; ring.style.transition = 'stroke-dashoffset 0.8s ease'; }, 100);

  // Category bars
  const catEl = document.getElementById('category-bars');
  catEl.innerHTML = '';
  for (const cat of (data.categoryScores ?? [])) {
    catEl.appendChild(renderBar(cat.category, cat.score));
  }

  // File bars (top 10)
  const fileEl = document.getElementById('file-bars');
  fileEl.innerHTML = '';
  const sorted = [...(data.fileScores ?? [])].sort((a, b) => a.score - b.score).slice(0, 10);
  for (const f of sorted) {
    const shortName = f.relativePath.split('/').pop() ?? f.relativePath;
    fileEl.appendChild(renderBar(shortName, f.score, () => {
      vscode.postMessage({ type: 'openFile', data: { filePath: f.file } });
    }));
  }

  // Danger zones
  const dangerEl = document.getElementById('danger-list');
  const zones = data.dangerZones ?? [];
  if (zones.length === 0) {
    dangerEl.innerHTML = '<p style="opacity:0.5">No danger zones! Keep auditing.</p>';
  } else {
    dangerEl.innerHTML = '';
    for (const z of zones) {
      const item = document.createElement('div');
      item.className = 'danger-item';
      item.innerHTML = `
        <div class="danger-info">
          <div>${z.relativePath}</div>
          <div class="danger-meta">${z.category} · Risk ${z.riskLevel}/10 · ${z.understandingScore}% understood</div>
        </div>
        <span class="badge badge-red">Open</span>`;
      item.addEventListener('click', () => {
        vscode.postMessage({ type: 'openFile', data: { filePath: z.file, lineNumber: z.startLine } });
      });
      dangerEl.appendChild(item);
    }
  }

  // Progress timeline
  renderTimeline(data.timeline ?? []);

  // History
  renderHistory(data.sessions);

  renderTeam(data.teamImports);

  // Learning path
  const learnEl = document.getElementById('learning-path');
  const items = data.learningPath ?? [];
  if (items.length === 0) {
    learnEl.innerHTML = '<p style="opacity:0.5">Complete a quiz to generate your learning path.</p>';
  } else {
    learnEl.innerHTML = '';
    for (const item of items) {
      const div = document.createElement('div');
      div.className = 'learning-item';
      div.innerHTML = `
        <div class="priority-num">${item.priority}</div>
        <div>
          <div class="learning-concept">${item.concept}</div>
          <div class="learning-file">${item.file}:${item.startLine}–${item.endLine}</div>
          <div class="learning-why">${item.whyItMatters}</div>
        </div>`;
      div.querySelector('.learning-file').addEventListener('click', () => {
        vscode.postMessage({ type: 'openFile', data: { filePath: item.file, lineNumber: item.startLine } });
      });
      learnEl.appendChild(div);
    }
  }
});

// Request report data on load
vscode.postMessage({ type: 'requestReport' });

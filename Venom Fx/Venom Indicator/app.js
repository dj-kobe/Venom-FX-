/* ============================================================
   ForexAI — AI-Powered Trading Platform
   app.js
   ============================================================ */

'use strict';

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const API_URL   = 'https://api.anthropic.com/v1/messages';
const AI_MODEL  = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1000;

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let selectedPair  = 'EUR/USD';
let selectedTf    = 'H4';
let uploadedImage = null; // base64 data URL

// ─────────────────────────────────────────────
// TICKER DATA (simulated live prices)
// ─────────────────────────────────────────────
const TICKERS = [
  { pair: 'EUR/USD', price: '1.0842', change: '+0.12%', dir: 'up' },
  { pair: 'GBP/USD', price: '1.2634', change: '-0.08%', dir: 'down' },
  { pair: 'USD/JPY', price: '154.23', change: '+0.31%', dir: 'up' },
  { pair: 'AUD/USD', price: '0.6518', change: '+0.05%', dir: 'up' },
  { pair: 'USD/CHF', price: '0.9041', change: '-0.14%', dir: 'down' },
  { pair: 'GBP/JPY', price: '194.82', change: '+0.22%', dir: 'up' },
];

// ─────────────────────────────────────────────
// AI SYSTEM PROMPT
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a professional forex trading analyst with deep expertise in technical analysis, price action, and chart pattern recognition.

Analyze the chart image provided and respond ONLY with a valid JSON object. No markdown, no backticks, no preamble — raw JSON only.

Return exactly this structure:
{
  "signal": "BUY" or "SELL" or "NEUTRAL",
  "confidence": number between 40 and 95,
  "entry": "price or zone description",
  "takeProfit1": "first take profit level",
  "takeProfit2": "second take profit level",
  "stopLoss": "stop loss level",
  "support": "key support level or zone",
  "resistance": "key resistance level or zone",
  "trend": "Bullish" or "Bearish" or "Ranging",
  "riskLevel": "Low" or "Medium" or "High",
  "patterns": ["pattern1", "pattern2"],
  "indicators": ["indicator reading 1", "indicator reading 2"],
  "summary": "2-3 sentence analysis of what you see on the chart and why you recommend this trade direction",
  "keyReason": "The single most important reason for this signal in one concise sentence"
}

If the image is not a forex or trading chart, return:
{"signal":"NEUTRAL","confidence":50,"entry":"N/A","takeProfit1":"N/A","takeProfit2":"N/A","stopLoss":"N/A","support":"N/A","resistance":"N/A","trend":"Ranging","riskLevel":"High","patterns":[],"indicators":[],"summary":"The uploaded image does not appear to be a forex or trading chart. Please upload a screenshot from a trading platform such as MetaTrader, TradingView, or similar.","keyReason":"Not a valid trading chart image."}`;

// ─────────────────────────────────────────────
// DOM REFERENCES
// ─────────────────────────────────────────────
const tickerStrip    = document.getElementById('tickerStrip');
const uploadZone     = document.getElementById('uploadZone');
const fileInput      = document.getElementById('fileInput');
const previewSection = document.getElementById('previewSection');
const previewImg     = document.getElementById('previewImg');
const removeBtn      = document.getElementById('removeBtn');
const pairGrid       = document.getElementById('pairGrid');
const tfRow          = document.getElementById('tfRow');
const analyzeBtn     = document.getElementById('analyzeBtn');
const analysisPanel  = document.getElementById('analysisPanel');
const analysisSubtitle = document.getElementById('analysisSubtitle');

// ─────────────────────────────────────────────
// TICKER RENDERING
// ─────────────────────────────────────────────
function renderTickers() {
  tickerStrip.innerHTML = TICKERS.map(t => `
    <div class="ticker-item">
      <span class="ticker-pair">${t.pair}</span>
      <span class="ticker-price">${t.price}</span>
      <span class="ticker-change ${t.dir}">${t.dir === 'up' ? '▲' : '▼'} ${t.change}</span>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────
// PAIR CHIP SELECTION
// ─────────────────────────────────────────────
function initPairChips() {
  pairGrid.querySelectorAll('.pair-chip').forEach(chip => {
    chip.addEventListener('click', () => selectPair(chip));
    chip.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectPair(chip);
      }
    });
  });
}

function selectPair(chip) {
  pairGrid.querySelectorAll('.pair-chip').forEach(c => {
    c.classList.remove('active');
    c.setAttribute('aria-checked', 'false');
  });
  chip.classList.add('active');
  chip.setAttribute('aria-checked', 'true');
  selectedPair = chip.dataset.pair;
}

// ─────────────────────────────────────────────
// TIMEFRAME CHIP SELECTION
// ─────────────────────────────────────────────
function initTfChips() {
  tfRow.querySelectorAll('.tf-chip').forEach(chip => {
    chip.addEventListener('click', () => selectTf(chip));
    chip.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectTf(chip);
      }
    });
  });
}

function selectTf(chip) {
  tfRow.querySelectorAll('.tf-chip').forEach(c => {
    c.classList.remove('active');
    c.setAttribute('aria-checked', 'false');
  });
  chip.classList.add('active');
  chip.setAttribute('aria-checked', 'true');
  selectedTf = chip.dataset.tf;
}

// ─────────────────────────────────────────────
// FILE UPLOAD HANDLING
// ─────────────────────────────────────────────
function initUpload() {
  // Drag & drop
  uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
  });

  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  });

  // File input
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) processFile(file);
  });

  // Keyboard activation
  uploadZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  // Remove button
  removeBtn.addEventListener('click', resetUpload);
}

function processFile(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    uploadedImage = ev.target.result;
    previewImg.src = uploadedImage;

    // Show preview, hide upload zone
    previewSection.style.display = 'block';
    uploadZone.style.display = 'none';

    // Enable analyze button
    analyzeBtn.disabled = false;

    // Update analysis panel hint
    showReadyHint();
  };
  reader.readAsDataURL(file);
}

function resetUpload() {
  uploadedImage = null;
  fileInput.value = '';
  previewSection.style.display = 'none';
  uploadZone.style.display = 'flex';
  analyzeBtn.disabled = true;
  showEmptyState();
  analysisSubtitle.textContent = 'Waiting for chart...';
}

// ─────────────────────────────────────────────
// ANALYSIS PANEL STATES
// ─────────────────────────────────────────────
function showEmptyState() {
  analysisPanel.innerHTML = `
    <div class="empty-state" id="emptyState">
      <div class="empty-icon">
        <i class="ti ti-brain" aria-hidden="true"></i>
      </div>
      <div class="empty-title">Ready to analyze</div>
      <p class="empty-sub">
        Upload a chart screenshot, select your currency pair and timeframe,<br />
        then press Analyze to receive your AI trade signal.
      </p>
    </div>`;
}

function showReadyHint() {
  analysisPanel.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon" style="color: var(--green); opacity: 0.9;">
        <i class="ti ti-check" aria-hidden="true"></i>
      </div>
      <div class="empty-title" style="color: var(--green);">Chart loaded!</div>
      <p class="empty-sub">
        Select your currency pair and timeframe,<br />
        then press <strong>Analyze Chart with AI</strong> to get your signal.
      </p>
    </div>`;
}

function showLoadingState() {
  analysisPanel.innerHTML = `
    <div class="loading-state">
      <div class="loading-dots" aria-label="Loading">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
      <div class="loading-msg">
        AI is analyzing your <strong>${selectedPair}</strong> ${selectedTf} chart…<br />
        <span style="font-size: 11px; opacity: 0.65;">Detecting patterns, indicators &amp; key levels</span>
      </div>
    </div>`;
}

function showErrorState(message) {
  analysisPanel.innerHTML = `
    <div class="error-state">
      <div class="error-icon">
        <i class="ti ti-alert-triangle" aria-hidden="true"></i>
      </div>
      <div class="error-title">Analysis failed</div>
      <p class="error-sub">${message || 'Please try again. Make sure the image is clear and shows a valid trading chart.'}</p>
    </div>`;
}

// ─────────────────────────────────────────────
// ANALYZE BUTTON
// ─────────────────────────────────────────────
function initAnalyzeButton() {
  analyzeBtn.addEventListener('click', runAnalysis);
}

async function runAnalysis() {
  if (!uploadedImage) return;

  // Update UI to loading
  analyzeBtn.disabled = true;
  analyzeBtn.innerHTML = `
    <div class="loading-dots" style="scale: 0.8">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>`;
  analysisSubtitle.textContent = `Analyzing ${selectedPair} ${selectedTf}…`;

  showLoadingState();

  try {
    const result = await callClaudeAPI();
    renderAnalysis(result);
    analysisSubtitle.textContent = `${selectedPair} ${selectedTf} — ${result.signal} signal`;
  } catch (err) {
    console.error('Analysis error:', err);
    showErrorState(err.message);
    analysisSubtitle.textContent = 'Analysis failed';
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = `<i class="ti ti-cpu" aria-hidden="true"></i> Analyze Chart with AI`;
  }
}

// ─────────────────────────────────────────────
// CLAUDE API CALL
// ─────────────────────────────────────────────
async function callClaudeAPI() {
  // Extract base64 and media type from data URL
  const [meta, base64Data] = uploadedImage.split(',');
  const mediaType = meta.match(/:(.*?);/)[1];

  const requestBody = {
    model: AI_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: `Analyze this ${selectedPair} ${selectedTf} chart and provide your trading recommendation as a JSON object.`,
          },
        ],
      },
    ],
  };

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const rawText = (data.content || [])
    .map(block => (block.type === 'text' ? block.text : ''))
    .join('');

  // Strip any accidental markdown fences
  const cleaned = rawText.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned an unexpected response format. Please try again.');
  }
}

// ─────────────────────────────────────────────
// RENDER ANALYSIS RESULTS
// ─────────────────────────────────────────────
function renderAnalysis(r) {
  const sig      = (r.signal || 'NEUTRAL').toLowerCase();
  const conf     = Math.min(95, Math.max(40, Number(r.confidence) || 65));
  const patterns = Array.isArray(r.patterns) ? r.patterns : [];
  const indicators = Array.isArray(r.indicators) ? r.indicators : [];

  // Risk meter segments
  const riskCount  = r.riskLevel === 'Low' ? 2 : r.riskLevel === 'Medium' ? 5 : 9;
  const riskClass  = r.riskLevel === 'Low' ? 'lit-low' : r.riskLevel === 'Medium' ? 'lit-mid' : 'lit-high';
  const segsHtml   = Array.from({ length: 10 }, (_, i) =>
    `<div class="risk-seg ${i < riskCount ? riskClass : ''}"></div>`
  ).join('');

  // Pattern tags
  const patternsHtml = patterns.length
    ? patterns.map(p => `<span class="tag active-tag">${escapeHTML(p)}</span>`).join('')
    : '<span class="tag">None detected</span>';

  // Indicator tags
  const indicatorsHtml = indicators.length
    ? indicators.map(i => `<span class="tag">${escapeHTML(i)}</span>`).join('')
    : '<span class="tag">No indicators visible</span>';

  analysisPanel.innerHTML = `
    <div class="analysis-content">

      <!-- Signal Banner -->
      <div class="signal-banner ${sig}">
        <div style="flex: 1;">
          <div class="signal-label">Trade Signal — ${escapeHTML(selectedPair)} ${escapeHTML(selectedTf)}</div>
          <div class="signal-text ${sig}">${escapeHTML(r.signal)}</div>
          <div class="confidence-bar">
            <div class="confidence-fill fill-${sig}" style="width: 0%" id="confFill"></div>
          </div>
          <div class="confidence-label">Confidence: ${conf}%</div>
        </div>
        <div class="trend-box">
          <div class="trend-label">Trend</div>
          <div class="trend-value">${escapeHTML(r.trend || 'N/A')}</div>
        </div>
      </div>

      <!-- Key Reason -->
      <div class="section-block">
        <div class="section-block-title">
          <i class="ti ti-target" aria-hidden="true"></i> Key reason
        </div>
        <div class="analysis-text key-reason-text">"${escapeHTML(r.keyReason || 'N/A')}"</div>
      </div>

      <!-- Trade Levels Metrics -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">
            <i class="ti ti-arrow-narrow-right" aria-hidden="true"></i> Entry Zone
          </div>
          <div class="metric-value">${escapeHTML(r.entry || 'N/A')}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">
            <i class="ti ti-shield" aria-hidden="true"></i> Stop Loss
          </div>
          <div class="metric-value down">${escapeHTML(r.stopLoss || 'N/A')}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">
            <i class="ti ti-circle-arrow-up" aria-hidden="true"></i> Take Profit 1
          </div>
          <div class="metric-value up">${escapeHTML(r.takeProfit1 || 'N/A')}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">
            <i class="ti ti-circle-arrow-up" aria-hidden="true"></i> Take Profit 2
          </div>
          <div class="metric-value up">${escapeHTML(r.takeProfit2 || 'N/A')}</div>
        </div>
      </div>

      <!-- Key Levels -->
      <div class="section-block">
        <div class="section-block-title">
          <i class="ti ti-chart-line" aria-hidden="true"></i> Key levels
        </div>
        <div class="levels-list">
          <div class="level-row">
            <span class="level-tag res">Resistance</span>
            <span class="level-price">${escapeHTML(r.resistance || 'N/A')}</span>
          </div>
          <div class="level-row">
            <span class="level-tag sup">Support</span>
            <span class="level-price">${escapeHTML(r.support || 'N/A')}</span>
          </div>
        </div>
      </div>

      <!-- Analysis Summary -->
      <div class="section-block">
        <div class="section-block-title">
          <i class="ti ti-info-circle" aria-hidden="true"></i> Analysis
        </div>
        <div class="analysis-text">${escapeHTML(r.summary || 'No summary available.')}</div>
      </div>

      <!-- Detected Patterns -->
      <div class="section-block">
        <div class="section-block-title">
          <i class="ti ti-eye" aria-hidden="true"></i> Detected patterns
        </div>
        <div class="tag-row">${patternsHtml}</div>
      </div>

      <!-- Indicator Readings -->
      <div class="section-block">
        <div class="section-block-title">
          <i class="ti ti-activity" aria-hidden="true"></i> Indicator readings
        </div>
        <div class="tag-row">${indicatorsHtml}</div>
      </div>

      <!-- Risk Level -->
      <div class="section-block">
        <div class="section-block-title">
          <i class="ti ti-alert-triangle" aria-hidden="true"></i>
          Risk level — ${escapeHTML(r.riskLevel || 'Unknown')}
        </div>
        <div class="risk-meter" role="meter" aria-label="Risk level meter">${segsHtml}</div>
      </div>

    </div>`;

  // Animate confidence bar after DOM insert
  requestAnimationFrame(() => {
    setTimeout(() => {
      const fill = document.getElementById('confFill');
      if (fill) fill.style.width = `${conf}%`;
    }, 80);
  });

  // Scroll analysis panel to top
  analysisPanel.scrollTop = 0;
}

// ─────────────────────────────────────────────
// UTILITY — XSS protection
// ─────────────────────────────────────────────
function escapeHTML(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
function init() {
  renderTickers();
  initPairChips();
  initTfChips();
  initUpload();
  initAnalyzeButton();
}

document.addEventListener('DOMContentLoaded', init);

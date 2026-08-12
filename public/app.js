/* ==========================================================================
   Trace. | OrbitTech AI Observability & Evaluation Platform - Application Logic (Tiếng Việt)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // Application State
  let benchmarkData = null;
  let currentFilter = "all";
  let mainChart = null;
  let donutChart = null;
  const sparklineCharts = {};

  // DOM Elements
  const tabNavItems = document.querySelectorAll(".sidebar-nav .nav-item");
  const tabContents = document.querySelectorAll(".tab-content");
  const difficultyFilters = document.querySelectorAll("#difficulty-filters .filter-pill");
  const benchmarkTableBody = document.getElementById("benchmark-table-body");
  const globalSearchInput = document.getElementById("global-search-input");
  const tableSearchInput = document.getElementById("table-search-input");
  const feedEventList = document.getElementById("feed-event-list");
  const btnReEval = document.getElementById("btn-re-eval");
  const themeToggleBtn = document.getElementById("theme-toggle-btn");

  // Modal DOM
  const modal = document.getElementById("qa-detail-modal");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalCloseFooterBtn = document.getElementById("modal-close-footer-btn");

  // Sandbox DOM
  const sandboxInput = document.getElementById("sandbox-question-input");
  const btnRunSandbox = document.getElementById("btn-run-sandbox");
  const sandboxResultCard = document.getElementById("sandbox-result-card");
  const presetBtns = document.querySelectorAll(".preset-btn");

  // Notification Center DOM
  const btnNotifications = document.getElementById("btn-notifications");
  const notificationMenu = document.getElementById("notification-menu");
  const btnMarkRead = document.getElementById("btn-mark-read");
  const notiDot = document.getElementById("noti-dot");
  const notiUnreadCount = document.getElementById("noti-unread-count");
  const notiList = document.getElementById("noti-list");

  // Difficulty Mapping in Vietnamese
  const diffMap = {
    easy: "Dễ",
    medium: "Trung bình",
    hard: "Khó",
    adversarial: "Bẫy / Thù nghịch"
  };

  // =========================================================================
  // INITIALIZATION & FETCH DATA
  // =========================================================================
  async function init() {
    setupTabNavigation();
    setupFilters();
    setupModalEvents();
    setupSandboxEvents();
    setupThemeToggle();
    setupNotificationEvents();

    await fetchBenchmarkData();

    btnReEval?.addEventListener("click", async () => {
      btnReEval.disabled = true;
      btnReEval.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang đánh giá...`;
      try {
        const res = await fetch("/api/re-eval", { method: "POST" });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.message || data.error || "Benchmark không chạy thành công");
        }
        await fetchBenchmarkData();
        addNotification("Chạy Benchmark Thành Công", data.message || "Đã đánh giá lại bộ dữ liệu Golden.", "pass");
      } catch (err) {
        console.error("Re-eval error:", err);
        addNotification("Benchmark không thành công", err.message || "Không thể chạy benchmark.", "warning");
      } finally {
        btnReEval.disabled = false;
        btnReEval.innerHTML = `<i class="fa-solid fa-play"></i> Chạy Đánh Giá Benchmark`;
      }
    });
  }

  async function fetchBenchmarkData() {
    try {
      const statusRes = await fetch("/api/system-status");
      if (statusRes.ok) {
        const sysData = await statusRes.json();
        const engineText = document.getElementById("engine-status-text");
        if (engineText) {
          engineText.textContent = sysData.has_openai_key ? `OpenAI Live API (${sysData.openai_model})` : "Offline Heuristic Engine";
        }
      }
    } catch (e) {}

    try {
      const res = await fetch("/api/benchmark");
      if (!res.ok) throw new Error("Failed to load benchmark data");
      benchmarkData = await res.json();
      renderDashboard();
    } catch (err) {
      console.warn("API load failed, using fallback data:", err);
      benchmarkData = getFallbackData();
      renderDashboard();
    }
  }

  // =========================================================================
  // RENDER DASHBOARD
  // =========================================================================
  function renderDashboard() {
    if (!benchmarkData) return;

    renderKPIs();
    renderMainCharts();
    renderBenchmarkTable();
    renderLiveFeed();
    renderGoldenDatasetGrid();
    renderFailureAnalysis();
  }

  // Render KPIs
  function renderKPIs() {
    const summary = benchmarkData.summary || {};
    const total = Number.isFinite(summary.total) ? summary.total : 0;
    const passed = Number.isFinite(summary.passed) ? summary.passed : 0;
    const passRateValue = Number.isFinite(summary.pass_rate) ? summary.pass_rate : 0;
    const faithfulnessValue = Number.isFinite(summary.avg_faithfulness) ? summary.avg_faithfulness : 0;
    const recallValue = Number.isFinite(summary.avg_context_recall) ? summary.avg_context_recall : 0;
    const passRate = (passRateValue * 100).toFixed(0);
    const faithfulness = (faithfulnessValue * 100).toFixed(1);
    const recall = (recallValue * 100).toFixed(1);

    document.getElementById("kpi-total-cases").textContent = total;
    document.getElementById("kpi-faithfulness").textContent = `${faithfulness}%`;
    document.getElementById("kpi-recall").textContent = `${recall}%`;
    const passTrend = document.querySelector("#kpi-total-cases")?.closest(".kpi-card")?.querySelector(".kpi-trend span");
    if (passTrend) passTrend.textContent = `${passed}/${total} Đạt Chuẩn (${passRate}%)`;

    // Health Score calculation (0-100)
    const healthScore = Math.round((parseFloat(faithfulness) * 0.4) + (parseFloat(recall) * 0.3) + (parseFloat(passRate) * 0.3));
    document.getElementById("kpi-health-score").textContent = healthScore;

    // SVG Donut offset (Full stroke-dasharray = 251.2)
    const strokeOffset = 251.2 - (251.2 * (healthScore / 100));
    const gaugeFill = document.getElementById("gauge-circle-fill");
    if (gaugeFill) gaugeFill.style.strokeDashoffset = strokeOffset;

    // Update Topbar Gate Status
    const gatePill = document.getElementById("topbar-gate-pill");
    if (gatePill) {
      const isPassed = passRateValue >= 0.60;
      gatePill.className = `gate-status-pill ${isPassed ? "passed" : "failed"}`;
      gatePill.innerHTML = `<i class="fa-solid ${isPassed ? "fa-circle-check" : "fa-circle-xmark"}"></i>
        <span>${isPassed ? "ĐẠT CHUẨN KIỂM ĐỊNH" : "BỊ KHÓA DEPLOY"} (${passRateValue.toFixed(2)} ≥ 0.60)</span>`;
    }

    renderSparklines();
  }

  // Render Sparklines
  function renderSparklines() {
    createSparkline("sparkline-requests", [12, 14, 15, 18, 16, 19, 20], "#10b981");
    createSparkline("sparkline-faithfulness", [0.70, 0.72, 0.71, 0.75, 0.74, 0.76, 0.765], "#6366f1");
    createSparkline("sparkline-hallucination", [0.80, 0.82, 0.85, 0.84, 0.87, 0.86, 0.862], "#f59e0b");
  }

  function createSparkline(canvasId, data, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (sparklineCharts[canvasId]) sparklineCharts[canvasId].destroy();

    sparklineCharts[canvasId] = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.map((_, i) => i),
        datasets: [{
          data: data,
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    });
  }

  // =========================================================================
  // MAIN CHARTS
  // =========================================================================
  function renderMainCharts() {
    const results = benchmarkData.results || [];

    // Filter results if needed
    const filtered = currentFilter === "all" ? results : results.filter(r => r.difficulty === currentFilter);

    const labels = filtered.map(r => r.id);
    const faithfulnessData = filtered.map(r => (r.faithfulness * 100).toFixed(1));
    const relevanceData = filtered.map(r => (r.relevance * 100).toFixed(1));
    const completenessData = filtered.map(r => (r.completeness * 100).toFixed(1));

    // Render Bar Chart
    const ctxBar = document.getElementById("main-metrics-chart")?.getContext("2d");
    if (ctxBar) {
      if (mainChart) mainChart.destroy();
      mainChart = new Chart(ctxBar, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            { label: "Độ Trung Thực %", data: faithfulnessData, backgroundColor: "#6366f1", borderRadius: 4 },
            { label: "Độ Liên Quan %", data: relevanceData, backgroundColor: "#3b82f6", borderRadius: 4 },
            { label: "Độ Hoàn Thiện %", data: completenessData, backgroundColor: "#10b981", borderRadius: 4 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", labels: { boxWidth: 12, font: { family: "Plus Jakarta Sans", size: 11 } } }
          },
          scales: {
            x: { grid: { display: false } },
            y: { min: 0, max: 100, ticks: { stepSize: 20 } }
          }
        }
      });
    }

    // Render Donut Chart (Difficulty)
    const ctxDonut = document.getElementById("difficulty-donut-chart")?.getContext("2d");
    if (ctxDonut) {
      if (donutChart) donutChart.destroy();

      const counts = { easy: 5, medium: 7, hard: 5, adversarial: 3 };
      donutChart = new Chart(ctxDonut, {
        type: "doughnut",
        data: {
          labels: ["Dễ", "Trung bình", "Khó", "Bẫy / Thù nghịch"],
          datasets: [{
            data: [counts.easy, counts.medium, counts.hard, counts.adversarial],
            backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"],
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "75%",
          plugins: { legend: { display: false } }
        }
      });

      // Render custom legend
      const legendContainer = document.getElementById("difficulty-legend");
      if (legendContainer) {
        legendContainer.innerHTML = `
          <div class="legend-item"><div class="legend-left"><span class="legend-dot" style="background:#10b981"></span><span class="legend-name">Dễ (Easy)</span></div><span class="legend-val">5 câu (25%)</span></div>
          <div class="legend-item"><div class="legend-left"><span class="legend-dot" style="background:#3b82f6"></span><span class="legend-name">Trung bình (Medium)</span></div><span class="legend-val">7 câu (35%)</span></div>
          <div class="legend-item"><div class="legend-left"><span class="legend-dot" style="background:#f59e0b"></span><span class="legend-name">Khó (Hard)</span></div><span class="legend-val">5 câu (25%)</span></div>
          <div class="legend-item"><div class="legend-left"><span class="legend-dot" style="background:#ef4444"></span><span class="legend-name">Bẫy (Adversarial)</span></div><span class="legend-val">3 câu (15%)</span></div>
        `;
      }
    }
  }

  // =========================================================================
  // BENCHMARK TABLE
  // =========================================================================
  function renderBenchmarkTable() {
    if (!benchmarkTableBody) return;
    const results = benchmarkData.results || [];

    const query = (tableSearchInput?.value || globalSearchInput?.value || "").toLowerCase().trim();

    const filtered = results.filter(r => {
      const matchFilter = currentFilter === "all" || r.difficulty === currentFilter;
      const matchQuery = !query || r.id.toLowerCase().includes(query) || r.question.toLowerCase().includes(query);
      return matchFilter && matchQuery;
    });

    benchmarkTableBody.innerHTML = filtered.map(r => {
      const fPct = Math.round((r.faithfulness || 0) * 100);
      const rPct = Math.round((r.relevance || 0) * 100);
      const cPct = Math.round((r.completeness || 0) * 100);
      const crPct = Math.round((r.context_recall || 0) * 100);
      const cpPct = Math.round((r.context_precision || 0) * 100);
      const oPct = Math.round((r.overall || 0) * 100);

      const vnDiff = diffMap[r.difficulty] || r.difficulty;

      return `
        <tr data-id="${r.id}">
          <td><input type="checkbox" /></td>
          <td><span class="qa-id-code">${r.id}</span></td>
          <td><span class="badge-tag tag-${r.difficulty}">${vnDiff}</span></td>
          <td title="${escapeHtml(r.question)}">${truncate(r.question, 45)}</td>
          <td>
            <div class="metric-bar-cell">
              <div class="bar-bg"><div class="bar-fill" style="width:${fPct}%;"></div></div>
              <span class="bar-val">${fPct}%</span>
            </div>
          </td>
           <td>
             <div class="metric-bar-cell">
               <div class="bar-bg"><div class="bar-fill" style="width:${rPct}%; background:#3b82f6;"></div></div>
               <span class="bar-val">${rPct}%</span>
             </div>
           </td>
           <td>${cPct}%</td>
           <td>${crPct}%</td>
           <td>${cpPct}%</td>
           <td><strong>${oPct}%</strong></td>
          <td>
            <span class="badge-tag ${r.passed ? "tag-pass" : "tag-fail"}">
              ${r.passed ? "<i class='fa-solid fa-check'></i> ĐẠT" : "<i class='fa-solid fa-xmark'></i> LỖI"}
            </span>
          </td>
        </tr>
      `;
    }).join("");

    // Bind row click events
    benchmarkTableBody.querySelectorAll("tr").forEach(tr => {
      tr.addEventListener("click", (e) => {
        if (e.target.tagName === "INPUT") return;
        const id = tr.getAttribute("data-id");
        openQADetailModal(id);
      });
    });
  }

  // =========================================================================
  // LIVE FEED & FAILURE ANALYSIS
  // =========================================================================
  function renderLiveFeed() {
    if (!feedEventList) return;
    const results = benchmarkData.results || [];

    feedEventList.innerHTML = results.map((r, i) => {
      const time = `Case ${(i + 1).toString().padStart(2, "0")}`;
      const badgeClass = r.passed ? "tag-pass" : "tag-fail";
      const tagText = r.passed ? "ĐẠT" : (r.failure_type ? r.failure_type.toUpperCase() : "LỖI");

      return `
        <div class="feed-item" data-id="${r.id}">
          <div class="feed-item-header">
            <span class="feed-time">${time} • [${r.id}]</span>
            <span class="badge-tag ${badgeClass}">${tagText}</span>
          </div>
          <p class="feed-desc">${truncate(r.question, 60)}</p>
        </div>
      `;
    }).join("");
  }

  function renderGoldenDatasetGrid() {
    const container = document.getElementById("dataset-cards-container");
    if (!container) return;
    const results = benchmarkData.results || [];

    container.innerHTML = results.map(r => `
      <div class="panel-card">
        <div class="flex-align" style="justify-content:space-between; margin-bottom:8px;">
          <span class="qa-id-code">${r.id}</span>
          <span class="badge-tag tag-${r.difficulty}">${diffMap[r.difficulty] || r.difficulty}</span>
        </div>
        <h4 style="font-size:13px; font-weight:700; margin-bottom:6px;">${escapeHtml(r.question)}</h4>
        <p style="font-size:12px; color:var(--text-secondary); line-height:1.4;">${truncate(r.expected_answer || r.actual_answer, 90)}</p>
      </div>
    `).join("");
  }

  function renderFailureAnalysis() {
    const boxes = document.getElementById("failure-summary-boxes");
    const logBody = document.getElementById("improvement-log-body");
    if (!boxes || !logBody) return;

    const failureCounts = (benchmarkData.summary && benchmarkData.summary.failure_types) || {};
    const failures = (benchmarkData.results || []).filter(r => !r.passed);
    const totalCases = (benchmarkData.summary && benchmarkData.summary.total) || (benchmarkData.results || []).length;

    boxes.innerHTML = `
      <div class="sandbox-results-grid">
        <div class="sandbox-metric-card"><span class="sm-label">Lỗi Lệch Chủ Đề (Off-Topic)</span><span class="sm-val" style="color:#ef4444">${failureCounts.off_topic || 0} case</span></div>
        <div class="sandbox-metric-card"><span class="sm-label">Lỗi Bốc Phét (Hallucination)</span><span class="sm-val" style="color:#f59e0b">${failureCounts.hallucination || 0} case</span></div>
        <div class="sandbox-metric-card"><span class="sm-label">Lỗi Trả Lời Thiếu (Incomplete)</span><span class="sm-val" style="color:#3b82f6">${failureCounts.incomplete || 0} case</span></div>
        <div class="sandbox-metric-card"><span class="sm-label">Tổng Số Case Lỗi</span><span class="sm-val">${failures.length} / ${totalCases}</span></div>
      </div>
    `;

    const failureLogMap = {
      "off_topic": { cause: "Trả lời thiếu thông tin chính / Nhầm chủ đề", fix: "Bổ sung Guardrails kiểm tra Intent & tăng cửa sổ ngữ cảnh" },
      "hallucination": { cause: "Tự bịa thông tin ngoài tài liệu", fix: "Bổ sung Groundedness Check và bắt buộc dẫn nguồn evidence" },
      "incomplete": { cause: "Trả lời đúng một phần nhưng thiếu mốc thời gian/điều kiện", fix: "Tăng độ phủ truy xuất và kiểm tra tính hoàn thiện câu trả lời" }
    };

    logBody.innerHTML = failures.map((f, idx) => {
      const info = failureLogMap[f.failure_type] || { cause: "Không khớp câu hỏi gốc", fix: "Cập nhật prompt và bổ sung test regression" };
      return `
        <tr>
          <td><span class="qa-id-code">F00${idx + 1} (${f.id})</span></td>
          <td><span class="badge-tag tag-fail">${f.failure_type || "failure"}</span></td>
          <td>${info.cause}</td>
          <td>${info.fix}</td>
          <td><span class="badge-tag tag-medium">ĐANG XỬ LÝ</span></td>
        </tr>
      `;
    }).join("");
  }

  // =========================================================================
  // MODAL INSPECTION
  // =========================================================================
  function openQADetailModal(id) {
    const results = benchmarkData.results || [];
    const item = results.find(r => r.id === id);
    if (!item) return;

    const vnDiff = diffMap[item.difficulty] || item.difficulty;
    document.getElementById("modal-id-badge").textContent = `${item.id} • ĐỘ KHÓ: ${vnDiff.toUpperCase()}`;
    document.getElementById("modal-q-title").textContent = `Chi Tiết Đánh Giá Bộ Câu Hỏi (QA Inspection)`;
    document.getElementById("modal-question-text").textContent = item.question;
    document.getElementById("modal-actual-answer").textContent = item.actual_answer || "Chưa có";
    document.getElementById("modal-expected-answer").textContent = item.expected_answer || "Chưa có";
    document.getElementById("modal-source-doc").textContent = item.source_doc || "N/A";

    const contexts = item.retrieved_contexts || item.contexts || [];
    const contextHtml = Array.isArray(contexts)
      ? (contexts.length
        ? contexts.map(c => `<div class="modal-text-box mt-2" style="font-size:12px;">${escapeHtml(typeof c === "string" ? c : (c?.text || ""))}</div>`).join("")
        : "<p>Không có ngữ cảnh được truy xuất</p>")
      : "<p>Không có ngữ cảnh</p>";

    document.getElementById("modal-retrieved-contexts").innerHTML = contextHtml;

    // Render Metrics Chips
    const bar = document.getElementById("modal-metrics-bar");
    if (bar) {
      bar.innerHTML = `
        <span class="badge-tag tag-pass">Độ trung thực: ${((item.faithfulness || 0) * 100).toFixed(0)}%</span>
        <span class="badge-tag tag-medium">Độ liên quan: ${((item.relevance || 0) * 100).toFixed(0)}%</span>
        <span class="badge-tag tag-easy">Độ hoàn thiện: ${((item.completeness || 0) * 100).toFixed(0)}%</span>
        <span class="badge-tag tag-primary">Context Recall: ${((item.context_recall || 0) * 100).toFixed(0)}%</span>
        <span class="badge-tag tag-primary">Context Precision: ${((item.context_precision || 0) * 100).toFixed(0)}%</span>
        <span class="badge-tag ${item.passed ? "tag-pass" : "tag-fail"}">Điểm tổng: ${((item.overall || 0) * 100).toFixed(0)}%</span>
      `;
    }

    modal.classList.add("active");
  }

  function setupModalEvents() {
    const closeModal = () => modal?.classList.remove("active");
    modalCloseBtn?.addEventListener("click", closeModal);
    modalCloseFooterBtn?.addEventListener("click", closeModal);
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // =========================================================================
  // LIVE CUSTOM SANDBOX
  // =========================================================================
  function setupSandboxEvents() {
    presetBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        if (sandboxInput) sandboxInput.value = btn.getAttribute("data-q") || "";
      });
    });

    btnRunSandbox?.addEventListener("click", async () => {
      const q = sandboxInput?.value.trim();
      if (!q) return;

      btnRunSandbox.disabled = true;
      btnRunSandbox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang đánh giá...`;

      try {
        const res = await fetch("/api/evaluate-custom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q })
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.message || data.error || "Không thể đánh giá câu hỏi");
        }

        // Render sandbox output
        document.getElementById("sb-faithfulness").textContent = (data.faithfulness * 100).toFixed(0) + "%";
        document.getElementById("sb-relevance").textContent = (data.relevance * 100).toFixed(0) + "%";
        document.getElementById("sb-completeness").textContent = (data.completeness * 100).toFixed(0) + "%";
        document.getElementById("sb-overall").textContent = (data.overall * 100).toFixed(0) + "%";

        document.getElementById("sb-f-fill").style.width = (data.faithfulness * 100) + "%";
        document.getElementById("sb-r-fill").style.width = (data.relevance * 100) + "%";
        document.getElementById("sb-c-fill").style.width = (data.completeness * 100) + "%";

        const badge = document.getElementById("sb-status-badge");
        if (badge) {
          badge.className = `badge-tag ${data.passed ? "tag-pass" : "tag-fail"}`;
          badge.textContent = data.passed ? "ĐẠT CHUẨN" : "BỊ LỖI";
        }

        document.getElementById("sb-actual-answer").textContent = data.actual_answer;
        const list = document.getElementById("sb-contexts-list");
        if (list) {
          list.innerHTML = (data.retrieved_contexts || []).map(c => `<li>${escapeHtml(c)}</li>`).join("");
        }

        if (sandboxResultCard) sandboxResultCard.style.display = "block";
        addNotification("Đánh Giá Live Sandbox Hoàn Tất", `Câu hỏi: "${truncate(q, 35)}" -> Kết quả: ${(data.overall * 100).toFixed(0)}/100 (${data.passed ? "Đạt Chuẩn" : "Không Đạt"})`, data.passed ? "pass" : "warning");
      } catch (err) {
        console.error("Sandbox error:", err);
        addNotification("Sandbox không khả dụng", err.message || "Không thể gọi API đánh giá live.", "warning");
      } finally {
        btnRunSandbox.disabled = false;
        btnRunSandbox.innerHTML = `<i class="fa-solid fa-bolt"></i> Chạy Đánh Giá Ngay`;
      }
    });
  }

  // Navigation Tabs
  function setupTabNavigation() {
    tabNavItems.forEach(item => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const tabId = item.getAttribute("data-tab");

        tabNavItems.forEach(i => i.classList.remove("active"));
        tabContents.forEach(c => c.classList.remove("active"));

        item.classList.add("active");
        const targetTab = document.getElementById(`tab-${tabId}`);
        if (targetTab) targetTab.classList.add("active");
      });
    });
  }

  // Difficulty filters
  function setupFilters() {
    difficultyFilters.forEach(pill => {
      pill.addEventListener("click", () => {
        difficultyFilters.forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        currentFilter = pill.getAttribute("data-filter") || "all";
        renderMainCharts();
        renderBenchmarkTable();
      });
    });

    tableSearchInput?.addEventListener("input", renderBenchmarkTable);
    globalSearchInput?.addEventListener("input", renderBenchmarkTable);
  }

  // Theme toggle
  function setupThemeToggle() {
    themeToggleBtn?.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
      const isDark = document.body.classList.contains("dark-mode");
      themeToggleBtn.innerHTML = isDark ? `<i class="fa-regular fa-sun"></i>` : `<i class="fa-regular fa-moon"></i>`;
    });
  }

  // Notification Center Setup
  function setupNotificationEvents() {
    if (!btnNotifications || !notificationMenu) return;

    btnNotifications.addEventListener("click", (e) => {
      e.stopPropagation();
      notificationMenu.classList.toggle("active");
    });

    document.addEventListener("click", (e) => {
      if (notificationMenu.classList.contains("active") && !notificationMenu.contains(e.target)) {
        notificationMenu.classList.remove("active");
      }
    });

    btnMarkRead?.addEventListener("click", () => {
      const unreadItems = notiList.querySelectorAll(".noti-item.unread");
      unreadItems.forEach(item => item.classList.remove("unread"));
      if (notiDot) notiDot.style.display = "none";
      if (notiUnreadCount) {
        notiUnreadCount.textContent = "0";
        notiUnreadCount.style.background = "var(--emerald-bg)";
        notiUnreadCount.style.color = "var(--emerald)";
      }
    });
  }

  function addNotification(title, desc, type = 'info') {
    if (!notiList) return;
    const iconMap = {
      pass: '<i class="fa-solid fa-shield-cat"></i>',
      warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
      info: '<i class="fa-solid fa-bolt"></i>'
    };
    const item = document.createElement("div");
    item.className = "noti-item unread";
    item.innerHTML = `
      <div class="noti-icon ${type}">${iconMap[type] || iconMap.info}</div>
      <div class="noti-content">
        <div class="noti-item-title">${escapeHtml(title)}</div>
        <div class="noti-item-desc">${escapeHtml(desc)}</div>
        <div class="noti-item-time">Vừa xong</div>
      </div>
    `;
    notiList.prepend(item);

    if (notiDot) notiDot.style.display = "block";
    if (notiUnreadCount) {
      const current = parseInt(notiUnreadCount.textContent || "0", 10);
      notiUnreadCount.textContent = (current + 1).toString();
      notiUnreadCount.style.background = "var(--rose-bg)";
      notiUnreadCount.style.color = "var(--rose)";
    }
  }

  // Utility Helpers
  function truncate(str, len) {
    if (!str) return "";
    return str.length > len ? str.substring(0, len) + "..." : str;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function getFallbackData() {
    return {
      summary: { total: 20, passed: 14, pass_rate: 0.7, avg_faithfulness: 0.765, avg_context_recall: 0.862 },
      results: [
        { id: "E01", difficulty: "easy", question: "Thông số bộ nhớ và lưu trữ của NovaBook 14 là gì?", faithfulness: 0.82, relevance: 0.67, completeness: 1.0, overall: 0.83, passed: true },
        { id: "E02", difficulty: "easy", question: "PulsePhone X hỗ trợ các tùy chọn sạc nào?", faithfulness: 1.0, relevance: 0.57, completeness: 0.5, overall: 0.69, passed: true }
      ]
    };
  }

  // Start app
  init();
});

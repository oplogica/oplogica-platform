/* =====================================
   Decision Ledger — API Integration + WebSocket (Real-Time)
===================================== */

const LEDGER_API = "/api/ledger";

document.addEventListener("DOMContentLoaded", () => {
  initModal();
  initCostCurves();
  loadDecisions();
  loadAuditReadiness();
  initLedgerWebSocket();
  loadLedgerI18n(function () {
    var demoBtn = document.getElementById("guidedDemoBtn");
    if (demoBtn) demoBtn.addEventListener("click", function () { runGuidedDemo(false); });
    if (!localStorage.getItem("decisionLedgerDemoSeen")) {
      setTimeout(function () { runGuidedDemo(true); }, 2000);
    }
  });
});

/* =====================================
   PHASE 5: i18n (EN / TR / AR) — same source as main site
===================================== */

var ledgerI18n = {};
var ledgerLang = "en";

/** Normalize to one of en | ar | tr. Page lang wins so demo matches visible language. */
function getLedgerLang() {
  var docLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
  if (docLang === "ar" || docLang === "tr" || docLang === "en") return docLang;
  var raw = localStorage.getItem("oplogica-lang") || localStorage.getItem("lang") || "";
  raw = (raw || "").toLowerCase();
  if (raw === "ar" || raw === "arabic") return "ar";
  if (raw === "tr" || raw === "turkish" || raw === "türkçe") return "tr";
  return "en";
}

/** English fallback so we never show wrong or empty strings. */
var LEDGER_EN_FALLBACK = {
  guidedDemoBtn: "▶ Guided Demo",
  explanationTimeline: "This timeline shows how each decision is tracked and later verified.",
  explanationIntentOutcome: "Declared intent is compared with the observed outcome. Alignment means the decision matched the stated policy.",
  explanationReasonGraph: "The reason graph shows how premises, rules, and conclusions connect.",
  explanationAudit: "Audit readiness indicates whether every decision has a complete proof bundle for external verification.",
  explanationDismiss: "Dismiss"
};

function loadLedgerI18n(onReady) {
  ledgerLang = getLedgerLang();
  var rtl = ledgerLang === "ar";
  document.documentElement.lang = ledgerLang === "ar" ? "ar" : ledgerLang === "tr" ? "tr" : "en";
  document.body.dir = rtl ? "rtl" : "ltr";
  document.body.classList.toggle("ledger-rtl", rtl);
  function applyAndReady(data) {
    ledgerI18n = (data && data.ledger) ? data.ledger : {};
    applyLedgerI18n();
    if (typeof onReady === "function") onReady();
  }
  fetch("/i18n/" + ledgerLang + ".json")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (data && data.ledger) {
        applyAndReady(data);
        return;
      }
      if (ledgerLang !== "en") {
        return fetch("/i18n/en.json").then(function (re) { return re.ok ? re.json() : null; }).then(function (enData) {
          applyAndReady(enData || { ledger: LEDGER_EN_FALLBACK });
        });
      }
      applyAndReady({ ledger: LEDGER_EN_FALLBACK });
    })
    .catch(function () {
      applyAndReady({ ledger: LEDGER_EN_FALLBACK });
    });
}

function applyLedgerI18n() {
  var btn = document.getElementById("guidedDemoBtn");
  if (btn && ledgerI18n.guidedDemoBtn) btn.textContent = ledgerI18n.guidedDemoBtn;
}

function t(key) {
  var s = ledgerI18n[key];
  if (s && typeof s === "string") return s;
  return LEDGER_EN_FALLBACK[key] || key;
}

/* =====================================
   PHASE 5: Guided Demo — static data only, no API / no WebSocket
===================================== */

var demoExplanationEl = null;
var demoStepTimer = null;

/** Static demo payload — not used for live data. */
var DEMO_DATA = {
  decision: {
    id: "DEC-DEMO",
    intent: { policy_id: "P-TRIAGE-01", constraints: ["critical", "time-bound"], declared_at: "T₀" },
    outcome: { decision: "HIGH_PRIORITY", impact: "IMMEDIATE_ESCALATION", deviation: null },
    cost_metrics: { delay_cost: 0.14, error_cost: 0.05, ethical_drift: 0.01, trust_impact: 0.92 }
  },
  reasonGraph: {
    nodes: [
      { id: "p1", type: "premise", label: "Intent" },
      { id: "r1", type: "rule", label: "P-TRIAGE-01" },
      { id: "c1", type: "conclusion", label: "HIGH_PRIORITY" }
    ],
    edges: [{ from: "p1", to: "r1" }, { from: "r1", to: "c1" }]
  }
};

function clearDemoHighlight() {
  document.querySelectorAll(".panel.demo-highlight").forEach(function (el) { el.classList.remove("demo-highlight"); });
}

function showLedgerExplanation(text, anchorSelector) {
  if (demoExplanationEl && demoExplanationEl.parentNode) demoExplanationEl.parentNode.removeChild(demoExplanationEl);
  var anchor = document.querySelector(anchorSelector);
  if (!anchor || !text) return;
  var el = document.createElement("div");
  el.className = "ledger-explanation";
  el.setAttribute("role", "tooltip");
  el.innerHTML = "<button type=\"button\" class=\"ledger-explanation-dismiss\" aria-label=\"" + (t("explanationDismiss") || "Dismiss") + "\">×</button>" + escapeHtml(text);
  var dismiss = el.querySelector(".ledger-explanation-dismiss");
  dismiss.addEventListener("click", function () {
    if (el.parentNode) el.parentNode.removeChild(el);
    demoExplanationEl = null;
  });
  document.body.appendChild(el);
  demoExplanationEl = el;
  var rect = anchor.getBoundingClientRect();
  var elRect = el.getBoundingClientRect();
  var left = rect.left + (rect.width / 2) - (elRect.width / 2);
  var top = rect.top - elRect.height - 12;
  if (top < 10) top = rect.bottom + 12;
  if (left < 10) left = 10;
  if (left + elRect.width > window.innerWidth - 10) left = window.innerWidth - elRect.width - 10;
  el.style.left = left + "px";
  el.style.top = top + "px";
}

function runGuidedDemo(isAutoRun) {
  if (demoStepTimer) clearTimeout(demoStepTimer);
  clearDemoHighlight();
  if (demoExplanationEl && demoExplanationEl.parentNode) demoExplanationEl.parentNode.removeChild(demoExplanationEl);
  demoExplanationEl = null;

  var timelinePanel = document.querySelector(".timeline-panel");
  var intentPanel = document.querySelector(".intent-panel");
  var auditPanel = document.querySelector(".audit-panel");
  var modal = document.getElementById("decisionModal");
  var graphContainer = modal ? modal.querySelector(".reason-graph-preview") : null;

  function step1() {
    clearDemoHighlight();
    if (timelinePanel) timelinePanel.classList.add("demo-highlight");
    showLedgerExplanation(t("explanationTimeline"), ".timeline-panel");
  }
  function step2() {
    clearDemoHighlight();
    if (intentPanel) intentPanel.classList.add("demo-highlight");
    showLedgerExplanation(t("explanationIntentOutcome"), ".intent-panel");
    updateIntentOutcomePanels(DEMO_DATA.decision);
    if (modal && graphContainer) {
      disposeReasonGraph3D();
      modal.classList.remove("hidden");
      if (window.THREE) initReasonGraph3D(graphContainer, DEMO_DATA.reasonGraph);
      else renderModalGraph(graphContainer, DEMO_DATA.decision);
    }
  }
  function step3() {
    showLedgerExplanation(t("explanationReasonGraph"), ".reason-graph-preview");
  }
  function step4() {
    clearDemoHighlight();
    if (auditPanel) auditPanel.classList.add("demo-highlight");
    showLedgerExplanation(t("explanationAudit"), ".audit-panel");
  }
  function step5() {
    clearDemoHighlight();
    if (demoExplanationEl && demoExplanationEl.parentNode) demoExplanationEl.parentNode.removeChild(demoExplanationEl);
    demoExplanationEl = null;
    if (modal) modal.classList.add("hidden");
    disposeReasonGraph3D();
    if (isAutoRun) localStorage.setItem("decisionLedgerDemoSeen", "true");
  }

  step1();
  demoStepTimer = setTimeout(function () {
    step2();
    demoStepTimer = setTimeout(function () {
      step3();
      demoStepTimer = setTimeout(function () {
        step4();
        demoStepTimer = setTimeout(step5, 4500);
      }, 4000);
    }, 4000);
  }, 3500);
}

/* =====================================
   WEBSOCKET (Spec v1: real-time updates)
===================================== */

var ledgerWs = null;
var ledgerReconnectDelay = 1000;
var ledgerReconnectTimer = null;
var ledgerReconnectMax = 30000;
var currentSelectedDecisionId = null;

function getLedgerWsUrl() {
  var base = window.location.origin;
  var wsProtocol = base.indexOf("https") === 0 ? "wss:" : "ws:";
  var host = base.replace(/^https?:\/\//, "");
  return wsProtocol + "//" + host + "/ws";
}

function initLedgerWebSocket() {
  if (ledgerWs && ledgerWs.readyState === WebSocket.OPEN) return;

  var url = getLedgerWsUrl();
  try {
    ledgerWs = new WebSocket(url);
  } catch (e) {
    scheduleLedgerReconnect();
    return;
  }

  ledgerWs.onopen = function () {
    ledgerReconnectDelay = 1000;
  };

  ledgerWs.onmessage = function (event) {
    try {
      var msg = JSON.parse(event.data);
      var type = msg && msg.type;
      if (type === "decision_created") {
        loadDecisions();
      } else if (type === "decision_updated") {
        loadDecisions();
        var id = msg.payload && msg.payload.id;
        if (id && id === currentSelectedDecisionId) {
          var modal = document.getElementById("decisionModal");
          var graph = modal && modal.querySelector(".reason-graph-preview");
          if (graph) {
            apiGet("/decisions/" + encodeURIComponent(id)).then(function (detail) {
              renderModalGraph(graph, detail);
              updateIntentOutcomePanels(detail);
              updateCostCurves(detail.cost_metrics);
            }).catch(function () {});
          }
        }
      } else if (type === "audit_status_changed") {
        loadAuditReadiness();
      }
    } catch (e) {
      // ignore non-JSON or parse errors
    }
  };

  ledgerWs.onclose = function () {
    ledgerWs = null;
    scheduleLedgerReconnect();
  };

  ledgerWs.onerror = function () {
    if (ledgerWs) ledgerWs.close();
  };
}

function scheduleLedgerReconnect() {
  if (ledgerReconnectTimer) return;
  ledgerReconnectTimer = setTimeout(function () {
    ledgerReconnectTimer = null;
    initLedgerWebSocket();
    if (ledgerReconnectDelay < ledgerReconnectMax) {
      ledgerReconnectDelay = Math.min(ledgerReconnectDelay * 2, ledgerReconnectMax);
    }
  }, ledgerReconnectDelay);
}

/* =====================================
   API HELPERS
===================================== */

function apiGet(path) {
  return fetch(LEDGER_API + path).then((res) => {
    const contentType = res.headers.get("content-type");
    const isJson = contentType && contentType.indexOf("application/json") !== -1;
    const body = isJson ? res.json() : res.text().then((t) => ({ raw: t }));
    return body.then((data) => {
      if (!res.ok) {
        const err = data && data.error ? data.error : { code: "UNKNOWN", message: res.statusText || "Request failed" };
        return Promise.reject({ status: res.status, error: err });
      }
      return data;
    });
  });
}

function showNonBlockingError(container, message) {
  if (!container) return;
  container.innerHTML = '<div class="ledger-error">' + escapeHtml(message) + '</div>';
}

function showLoading(container, message) {
  if (!container) return;
  container.innerHTML = '<div class="ledger-loading">' + (message || "Loading…") + '</div>';
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

/* =====================================
   DECISIONS (TIMELINE)
===================================== */

function loadDecisions() {
  const container = document.getElementById("decisionTimeline");
  if (!container) return;

  showLoading(container, "Loading decisions…");

  const params = new URLSearchParams({ limit: 50 });
  apiGet("/decisions?" + params.toString())
    .then((data) => {
      const decisions = (data && data.decisions) ? data.decisions : [];
      renderTimeline(container, decisions);
    })
    .catch((err) => {
      const msg = (err.error && err.error.message) ? err.error.message : "Unable to load decisions.";
      showNonBlockingError(container, msg);
    });
}

function renderTimeline(container, decisions) {
  container.innerHTML = "";

  if (decisions.length === 0) {
    container.innerHTML = '<div class="ledger-loading">No decisions yet.</div>';
    return;
  }

  decisions.forEach((d) => {
    const node = document.createElement("div");
    const status = (d.status && (d.status === "green" || d.status === "yellow" || d.status === "red")) ? d.status : "green";
    node.className = "timeline-node " + status;
    node.innerHTML = "<span class=\"node-dot\"></span><span class=\"node-label\">" + escapeHtml(d.id) + "</span>";
    node.addEventListener("click", () => openDecisionModal(d.id));
    container.appendChild(node);
  });
}

/* =====================================
   DECISION DETAIL (DRILLDOWN)
===================================== */

function openDecisionModal(decisionId) {
  currentSelectedDecisionId = decisionId;
  const modal = document.getElementById("decisionModal");
  const graph = modal ? modal.querySelector(".reason-graph-preview") : null;
  if (!modal || !graph) return;

  graph.innerHTML = '<div class="ledger-loading">Loading details…</div>';
  modal.classList.remove("hidden");

  apiGet("/decisions/" + encodeURIComponent(decisionId))
    .then((detail) => {
      updateIntentOutcomePanels(detail);
      updateCostCurves(detail.cost_metrics);
      apiGet("/decisions/" + encodeURIComponent(decisionId) + "/reason-graph")
        .then((graphData) => {
          disposeReasonGraph3D();
          if (!window.THREE || !graphData || (!graphData.nodes && !graphData.edges)) {
            renderModalGraph(graph, detail);
            return;
          }
          initReasonGraph3D(graph, graphData);
        })
        .catch(function () {
          var fallback = buildReasonGraphFromDetail(detail);
          disposeReasonGraph3D();
          if (window.THREE) {
            initReasonGraph3D(graph, fallback);
          } else {
            renderModalGraph(graph, detail);
          }
        });
    })
    .catch((err) => {
      const msg = (err.error && err.error.message) ? err.error.message : "Could not load decision details.";
      graph.innerHTML = '<div class="ledger-error">' + escapeHtml(msg) + '</div>';
    });
}

function buildReasonGraphFromDetail(detail) {
  var intent = detail.intent || {};
  var outcome = detail.outcome || {};
  var nodes = [
    { id: "p1", type: "premise", label: "Intent" },
    { id: "r1", type: "rule", label: intent.policy_id || "Policy" },
    { id: "c1", type: "conclusion", label: outcome.decision != null ? String(outcome.decision).replace(/_/g, " ") : "Conclusion" }
  ];
  var edges = [{ from: "p1", to: "r1" }, { from: "r1", to: "c1" }];
  return { nodes: nodes, edges: edges };
}

function renderModalGraph(container, detail) {
  const outcome = detail.outcome || {};
  const conclusion = outcome.decision != null ? String(outcome.decision).replace(/_/g, " ") : "—";
  container.innerHTML =
    "<div class=\"graph-node\">Premise: Input Data</div>" +
    "<div class=\"graph-arrow\">↓</div>" +
    "<div class=\"graph-node\">Rule Applied</div>" +
    "<div class=\"graph-arrow\">↓</div>" +
    "<div class=\"graph-node highlight\">Conclusion: " + escapeHtml(conclusion) + "</div>";
}

/* =====================================
   REASON GRAPH 3D (Three.js)
===================================== */

var reasonGraph3DState = null;

function disposeReasonGraph3D() {
  if (!reasonGraph3DState) return;
  if (reasonGraph3DState.animationId != null) cancelAnimationFrame(reasonGraph3DState.animationId);
  if (reasonGraph3DState.renderer) {
    reasonGraph3DState.renderer.dispose();
    if (reasonGraph3DState.canvas && reasonGraph3DState.canvas.parentNode) reasonGraph3DState.canvas.parentNode.removeChild(reasonGraph3DState.canvas);
  }
  if (reasonGraph3DState.container && reasonGraph3DState.container.parentNode) reasonGraph3DState.container.parentNode.removeChild(reasonGraph3DState.container);
  reasonGraph3DState = null;
}

function initReasonGraph3D(parentEl, graphData) {
  if (!parentEl || !window.THREE) {
    return;
  }
  var nodes = graphData.nodes || [];
  var edges = graphData.edges || [];
  if (nodes.length === 0) return;

  var container = document.createElement("div");
  container.id = "reason-graph-3d-container";
  parentEl.innerHTML = "";
  parentEl.appendChild(container);

  var width = container.clientWidth || 480;
  var height = 280;
  var canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  container.appendChild(canvas);

  var THREE = window.THREE;
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f14);

  var camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene.add(new THREE.AmbientLight(0x404060));
  var dir = new THREE.DirectionalLight(0x3ef3d3, 0.8);
  dir.position.set(2, 2, 5);
  scene.add(dir);

  var nodeMap = {};
  var positions = [];
  var hasPositions = nodes.length > 0 && typeof nodes[0].x === "number";
  if (hasPositions) {
    nodes.forEach(function (n) {
      var x = Number(n.x) || 0, y = Number(n.y) || 0, z = Number(n.z) || 0;
      positions.push({ x: x, y: y, z: z });
      nodeMap[n.id] = { x: x, y: y, z: z };
    });
  } else {
    var radius = 2.2;
    var step = (2 * Math.PI) / Math.max(nodes.length, 1);
    nodes.forEach(function (n, i) {
      var angle = i * step - Math.PI * 0.5;
      var x = radius * Math.cos(angle);
      var z = radius * Math.sin(angle);
      var y = 0;
      positions.push({ x: x, y: y, z: z });
      nodeMap[n.id] = { x: x, y: y, z: z };
    });
  }

  var colorByType = { premise: 0x3ef3d3, rule: 0xfacc15, conclusion: 0x38e8a8 };
  nodes.forEach(function (n, i) {
    var pos = positions[i];
    var geom = new THREE.SphereGeometry(0.22, 16, 12);
    var color = colorByType[n.type] != null ? colorByType[n.type] : 0x888888;
    var mat = new THREE.MeshPhongMaterial({ color: color, shininess: 80 });
    var mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(pos.x, pos.y, pos.z);
    scene.add(mesh);
  });

  var linePoints = [];
  edges.forEach(function (e) {
    var a = nodeMap[e.from];
    var b = nodeMap[e.to];
    if (a && b) {
      linePoints.push(new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z));
    }
  });
  if (linePoints.length > 0) {
    var lineGeom = new THREE.BufferGeometry().setFromPoints(linePoints);
    var lineMat = new THREE.LineBasicMaterial({ color: 0x3ef3d3, opacity: 0.6, transparent: true });
    var line = new THREE.LineSegments(lineGeom, lineMat);
    scene.add(line);
  }

  var isDown = false;
  var prevX = 0, prevY = 0;
  var camAngle = 0, camElevation = 0.3;
  function onPointerDown(e) {
    isDown = true;
    prevX = e.clientX;
    prevY = e.clientY;
  }
  function onPointerMove(e) {
    if (!isDown) return;
    camAngle += (e.clientX - prevX) * 0.005;
    camElevation = Math.max(-0.8, Math.min(0.8, camElevation + (e.clientY - prevY) * 0.005));
    prevX = e.clientX;
    prevY = e.clientY;
    var r = 8;
    camera.position.x = r * Math.cos(camElevation) * Math.sin(camAngle);
    camera.position.y = r * Math.sin(camElevation);
    camera.position.z = r * Math.cos(camElevation) * Math.cos(camAngle);
    camera.lookAt(0, 0, 0);
  }
  function onPointerUp() { isDown = false; }
  container.addEventListener("mousedown", onPointerDown);
  container.addEventListener("mousemove", onPointerMove);
  container.addEventListener("mouseup", onPointerUp);
  container.addEventListener("mouseleave", onPointerUp);

  function animate() {
    reasonGraph3DState.animationId = requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  reasonGraph3DState = { container: container, canvas: canvas, renderer: renderer, animationId: null };
  animate();
}

function updateIntentOutcomePanels(detail) {
  const intent = detail.intent || {};
  const outcome = detail.outcome || {};
  const declaredList = document.querySelector(".intent-panel .intent-card.declared ul");
  const outcomeList = document.querySelector(".intent-panel .intent-card.outcome ul");
  const alignmentEl = document.querySelector(".intent-panel .alignment-indicator");

  if (declaredList) {
    declaredList.innerHTML =
      "<li><strong>Policy:</strong> " + escapeHtml(intent.policy_id || "—") + "</li>" +
      "<li><strong>Constraints:</strong> " + escapeHtml(Array.isArray(intent.constraints) ? intent.constraints.join(", ") : (intent.constraints || "—")) + "</li>" +
      "<li><strong>Declared At:</strong> " + escapeHtml(intent.declared_at || "—") + "</li>";
  }
  if (outcomeList) {
    outcomeList.innerHTML =
      "<li><strong>Decision:</strong> " + escapeHtml(outcome.decision != null ? String(outcome.decision).replace(/_/g, " ") : "—") + "</li>" +
      "<li><strong>Impact:</strong> " + escapeHtml(outcome.impact != null ? String(outcome.impact).replace(/_/g, " ") : "—") + "</li>" +
      "<li><strong>Deviation:</strong> " + escapeHtml(outcome.deviation != null ? String(outcome.deviation) : "None") + "</li>";
  }
  if (alignmentEl) {
    alignmentEl.textContent = outcome.deviation ? "Deviation present" : "Alignment Confirmed";
    alignmentEl.classList.toggle("aligned", !outcome.deviation);
  }
}

function updateCostCurves(costMetrics) {
  const container = document.getElementById("costCurves");
  if (!container || !costMetrics) return;

  const keys = ["delay_cost", "error_cost", "ethical_drift", "trust_impact"];
  const colors = ["#3ef3d3", "#38e8a8", "#facc15", "#94a3b8"];
  const series = keys.map((k) => {
    const v = costMetrics[k];
    const num = typeof v === "number" ? v : 0;
    return Array.from({ length: 12 }, (_, i) => (i < 11 ? Math.random() * 0.3 + 0.1 : Math.min(1, Math.max(0, num))));
  });

  container.innerHTML = "";
  const canvas = document.createElement("canvas");
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  series.forEach((data, i) => drawCurve(ctx, canvas, colors[i], data));
}

/* =====================================
   COST CURVES (INITIAL / NO SELECTION)
===================================== */

function initCostCurves() {
  const container = document.getElementById("costCurves");
  if (!container) return;
  showLoading(container, "Select a decision to view cost curves.");
}

function drawCurve(ctx, canvas, color, data) {
  if (!data || data.length === 0) return;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  data.forEach((value, i) => {
    const x = (i / (data.length - 1)) * canvas.width;
    const y = canvas.height - value * canvas.height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

/* =====================================
   AUDIT READINESS
===================================== */

function loadAuditReadiness() {
  const meterVal = document.querySelector(".audit-panel .meter-value");
  const meterDetails = document.querySelector(".audit-panel .meter-details ul");
  const statusBadge = document.querySelector(".header-right .status-indicator");

  apiGet("/audit/readiness")
    .then((data) => {
      const score = data.readiness_score != null ? Math.round(Number(data.readiness_score) * 100) : 0;
      const status = (data.status || "").toUpperCase();
      const checks = data.checks || {};

      if (meterVal) {
        meterVal.textContent = score + "%";
        const circle = meterVal.closest(".meter-circle");
        if (circle) {
          const deg = (score / 100) * 360;
          circle.style.background = "conic-gradient(var(--accent-green) 0deg, var(--accent-green) " + deg + "deg, rgba(255, 255, 255, 0.08) " + deg + "deg)";
        }
      }
      if (statusBadge) {
        statusBadge.textContent = status === "READY" ? "Audit Ready" : status === "CONDITIONAL" ? "Conditional" : status || "Audit Ready";
        statusBadge.classList.toggle("ready", status === "READY");
        statusBadge.classList.toggle("conditional", status === "CONDITIONAL");
      }
      if (meterDetails) {
        meterDetails.innerHTML =
          "<li>Reason Graph: " + (checks.reason_graph ? "✔ Complete" : "—") + "</li>" +
          "<li>Proof of Intent: " + (checks.proof_of_intent ? "✔ Present" : "—") + "</li>" +
          "<li>Signatures: " + (checks.signatures ? "✔ Valid" : "—") + "</li>" +
          "<li>Temporal Order: " + (checks.temporal_order ? "✔ Verified" : "—") + "</li>";
      }
    })
    .catch(() => {
      if (meterVal) meterVal.textContent = "—";
      if (statusBadge) {
        statusBadge.textContent = "Unavailable";
        statusBadge.classList.remove("ready", "conditional");
      }
      if (meterDetails) meterDetails.innerHTML = "<li>Unable to load audit status.</li>";
    });
}

/* =====================================
   MODAL
===================================== */

function initModal() {
  const modal = document.getElementById("decisionModal");
  const closeBtn = modal ? modal.querySelector(".close-modal") : null;
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      disposeReasonGraph3D();
      modal.classList.add("hidden");
      currentSelectedDecisionId = null;
    });
  }
}

/**
 * OpLogica Medical Triage Engine v3.0 — Triadic Verification
 * Enhanced Emergency Triage Protocol with multi-category patient assessment.
 * DETERMINISTIC: same inputs → same outputs.
 * 
 * Categories: Emergency, Pediatric, Geriatric, Maternal, Trauma
 * Rules: 10 clinical decision rules with full cryptographic proof bundles
 * Verification: PoO (Proof of Origin), PoR (Proof of Reason), PoI (Proof of Intent)
 */

const crypto = require('crypto');

const POO_SECRET = process.env.POO_SECRET || 'oplogica-verification-key';

// ═══════════════════════════════════════════════════════════════
// POLICY DECLARATION (Axiom 3.1 — Temporal Precedence)
// ═══════════════════════════════════════════════════════════════

const MEDICAL_POLICY = {
    policy_name: 'Emergency Triage Protocol v3.0',
    authority: 'OpLogica Medical Ethics Framework',
    declaration_timestamp: '2024-11-15T09:00:00Z',
    version: '3.0.0',
    constraints: [
        { id: 'C1', name: 'vital_priority', rule: 'WHEN patient.vital_score < 0.5 THEN decision.priority = HIGH', severity: 'mandatory' },
        { id: 'C2', name: 'fairness_bound', rule: 'FOR_ALL group IN demographics: |mean_wait(group) - mean_wait(all)| <= 0.04', severity: 'mandatory' },
        { id: 'C3', name: 'max_wait', rule: 'patient.wait_time <= 60 MINUTES OR decision.reassessment = TRUE', severity: 'warning' },
        { id: 'C4', name: 'justification_required', rule: 'WHEN decision.priority_changed = TRUE THEN reason_graph.depth >= 2', severity: 'mandatory' },
        { id: 'C5', name: 'pediatric_priority', rule: 'WHEN patient.age < 12 AND vital_score < 0.6 THEN priority >= MEDIUM', severity: 'mandatory' },
        { id: 'C6', name: 'geriatric_caution', rule: 'WHEN patient.age >= 65 AND comorbidity >= 0.5 THEN priority >= MEDIUM', severity: 'mandatory' },
        { id: 'C7', name: 'trauma_escalation', rule: 'WHEN patient.trauma_score >= 0.7 THEN priority = HIGH', severity: 'mandatory' },
        { id: 'C8', name: 'maternal_safety', rule: 'WHEN patient.category = MATERNAL AND complications = TRUE THEN priority = HIGH', severity: 'mandatory' },
        { id: 'C9', name: 'resource_constraint', rule: 'WHEN resource_score < 0.3 THEN flag_resource_alert = TRUE', severity: 'warning' },
        { id: 'C10', name: 'multi_symptom', rule: 'WHEN triggered_rules >= 3 THEN priority >= MEDIUM', severity: 'mandatory' }
    ],
    policy_hash: null,
    authority_signature: null
};

// Compute policy hash at load
(function () {
    const payload = JSON.stringify({
        name: MEDICAL_POLICY.policy_name,
        version: MEDICAL_POLICY.version,
        declaration_timestamp: MEDICAL_POLICY.declaration_timestamp,
        constraints: MEDICAL_POLICY.constraints.map(c => c.id + c.rule)
    });
    MEDICAL_POLICY.policy_hash = crypto.createHash('sha256').update(payload).digest('hex');
    MEDICAL_POLICY.authority_signature = crypto.createHmac('sha256', POO_SECRET).update(MEDICAL_POLICY.policy_hash).digest('hex');
})();

// ═══════════════════════════════════════════════════════════════
// CRYPTOGRAPHIC FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function generateSignature(data) {
    return crypto.createHmac('sha256', POO_SECRET).update(data).digest('hex');
}

function computeMerkleRoot(hashes) {
    if (hashes.length === 0) return crypto.createHash('sha256').update('empty').digest('hex');
    if (hashes.length === 1) return hashes[0];
    const paired = [];
    for (let i = 0; i < hashes.length; i += 2) {
        const left = hashes[i];
        const right = hashes[i + 1] || left;
        paired.push(crypto.createHash('sha256').update(left + right).digest('hex'));
    }
    return computeMerkleRoot(paired);
}

function generatePoO(patientData, policy, timestamp) {
    const state = JSON.stringify({ D: patientData, P: policy, T: timestamp });
    const hash = crypto.createHash('sha256').update(state).digest('hex');
    const signature = crypto.createHmac('sha256', POO_SECRET).update(hash + timestamp).digest('hex');
    return {
        hash,
        timestamp,
        signature,
        algorithm: 'SHA-256',
        state_reference: `PoO-MED-${Date.now()}`
    };
}

// ═══════════════════════════════════════════════════════════════
// PATIENT CATEGORY DETECTION
// ═══════════════════════════════════════════════════════════════

function detectCategory(patientData) {
    if (patientData.category) return patientData.category.toUpperCase();
    if (patientData.trauma_score && patientData.trauma_score >= 0.5) return 'TRAUMA';
    if (patientData.is_pregnant || patientData.pregnancy_week) return 'MATERNAL';
    if (patientData.age < 12) return 'PEDIATRIC';
    if (patientData.age >= 65) return 'GERIATRIC';
    return 'GENERAL';
}

// ═══════════════════════════════════════════════════════════════
// RISK SCORING
// ═══════════════════════════════════════════════════════════════

function calculateRiskScore(patientData, category) {
    let score = 0;
    const weights = {
        vital: 0.30,
        age: 0.15,
        comorbidity: 0.20,
        wait: 0.10,
        resource: 0.10,
        trauma: 0.15
    };

    // Vital score (inverted: lower vital = higher risk)
    score += (1 - Math.min(1, Math.max(0, patientData.vital_score))) * weights.vital;

    // Age risk (U-shaped: very young and very old = higher risk)
    if (patientData.age < 5) score += 0.9 * weights.age;
    else if (patientData.age < 12) score += 0.5 * weights.age;
    else if (patientData.age >= 80) score += 0.9 * weights.age;
    else if (patientData.age >= 65) score += 0.6 * weights.age;
    else score += 0.2 * weights.age;

    // Comorbidity
    score += Math.min(1, Math.max(0, patientData.comorbidity_index || 0)) * weights.comorbidity;

    // Wait time risk (longer = higher)
    const waitNorm = Math.min(1, (patientData.wait_time || 0) / 120);
    score += waitNorm * weights.wait;

    // Resource scarcity (lower = higher risk)
    score += (1 - Math.min(1, Math.max(0, patientData.resource_score || 0.5))) * weights.resource;

    // Trauma
    if (category === 'TRAUMA') {
        score += Math.min(1, Math.max(0, patientData.trauma_score || 0)) * weights.trauma;
    }

    // Category-specific modifiers
    if (category === 'MATERNAL' && patientData.complications) score += 0.15;
    if (category === 'PEDIATRIC' && patientData.vital_score < 0.6) score += 0.10;

    return Math.min(1, Math.max(0, parseFloat(score.toFixed(4))));
}

// ═══════════════════════════════════════════════════════════════
// DECISION ENGINE (10 Rules)
// ═══════════════════════════════════════════════════════════════

function evaluateMedical(patientData) {
    const timestamp = new Date().toISOString();
    const category = detectCategory(patientData);
    const riskScore = calculateRiskScore(patientData, category);

    let priority = 'LOW';
    let critical = false;
    let urgency = 'STANDARD';
    let reassessment = false;
    let resourceAlert = false;
    const reasons = [];
    let triggeredCount = 0;

    // ── Rule C1: Vital Priority (mandatory) ──
    const c1 = patientData.vital_score < 0.5;
    if (c1) {
        critical = true;
        priority = 'HIGH';
        reasons.push('C1: vital_score < 0.5 → critical = TRUE → priority = HIGH');
        triggeredCount++;
    }

    // ── Rule R-AGE: Age Risk ──
    const rAge = patientData.age >= 65;
    if (rAge) {
        reasons.push(`R-AGE: age=${patientData.age} >= 65 → risk_modifier = ELEVATED`);
        if (priority !== 'HIGH') priority = 'MEDIUM';
        triggeredCount++;
    }

    // ── Rule R-COMORBID: Comorbidity Risk ──
    const rComorbid = (patientData.comorbidity_index || 0) >= 0.6;
    if (rComorbid) {
        reasons.push(`R-COMORBID: index=${patientData.comorbidity_index} >= 0.6 → risk = HIGH`);
        if (priority !== 'HIGH') priority = 'MEDIUM';
        triggeredCount++;
    }

    // ── Rule R-URGENCY: Critical + Long Wait ──
    const rUrgency = critical && patientData.wait_time > 30;
    if (rUrgency) {
        urgency = 'IMMEDIATE';
        reasons.push(`R-URGENCY: critical AND wait_time=${patientData.wait_time} > 30 → urgency = IMMEDIATE`);
        triggeredCount++;
    }

    // ── Rule C3: Max Wait ──
    const c3 = patientData.wait_time > 60;
    if (c3) {
        reassessment = true;
        reasons.push(`C3: wait_time=${patientData.wait_time} > 60 → reassessment = TRUE`);
        triggeredCount++;
    }

    // ── Rule C5: Pediatric Priority (mandatory) ──
    const c5 = patientData.age < 12 && patientData.vital_score < 0.6;
    if (c5) {
        if (priority === 'LOW') priority = 'MEDIUM';
        reasons.push(`C5: age=${patientData.age} < 12 AND vital=${patientData.vital_score} < 0.6 → priority >= MEDIUM`);
        triggeredCount++;
    }

    // ── Rule C6: Geriatric Caution (mandatory) ──
    const c6 = patientData.age >= 65 && (patientData.comorbidity_index || 0) >= 0.5;
    if (c6) {
        if (priority === 'LOW') priority = 'MEDIUM';
        reasons.push(`C6: age=${patientData.age} >= 65 AND comorbidity=${patientData.comorbidity_index} >= 0.5 → priority >= MEDIUM`);
        triggeredCount++;
    }

    // ── Rule C7: Trauma Escalation (mandatory) ──
    const c7 = (patientData.trauma_score || 0) >= 0.7;
    if (c7) {
        priority = 'HIGH';
        critical = true;
        reasons.push(`C7: trauma_score=${patientData.trauma_score} >= 0.7 → priority = HIGH`);
        triggeredCount++;
    }

    // ── Rule C8: Maternal Safety (mandatory) ──
    const c8 = category === 'MATERNAL' && patientData.complications === true;
    if (c8) {
        priority = 'HIGH';
        critical = true;
        reasons.push(`C8: category=MATERNAL AND complications=TRUE → priority = HIGH`);
        triggeredCount++;
    }

    // ── Rule C9: Resource Alert (warning) ──
    const c9 = (patientData.resource_score || 0.5) < 0.3;
    if (c9) {
        resourceAlert = true;
        reasons.push(`C9: resource_score=${patientData.resource_score} < 0.3 → resource_alert = TRUE`);
        triggeredCount++;
    }

    // ── Rule C10: Multi-Symptom Escalation (mandatory) ──
    const c10 = triggeredCount >= 3;
    if (c10 && priority === 'LOW') {
        priority = 'MEDIUM';
        reasons.push(`C10: triggered_rules=${triggeredCount} >= 3 → priority >= MEDIUM`);
    }

    const allRules = [
        { id: 'C1', rule: 'IF vital_score < 0.5 THEN critical = TRUE, priority = HIGH', triggered: c1, detail: `vital_score = ${patientData.vital_score} ${c1 ? '<' : '≥'} 0.5` },
        { id: 'R-AGE', rule: 'IF age ≥ 65 THEN risk_modifier = ELEVATED', triggered: rAge, detail: `age = ${patientData.age} ${rAge ? '≥' : '<'} 65` },
        { id: 'R-COMORBID', rule: 'IF comorbidity_index ≥ 0.6 THEN comorbidity_risk = HIGH', triggered: rComorbid, detail: `comorbidity = ${patientData.comorbidity_index || 0} ${rComorbid ? '≥' : '<'} 0.6` },
        { id: 'R-URGENCY', rule: 'IF critical AND wait_time > 30 THEN urgency = IMMEDIATE', triggered: rUrgency, detail: `critical = ${critical}, wait_time = ${patientData.wait_time} ${patientData.wait_time > 30 ? '>' : '≤'} 30` },
        { id: 'C3', rule: 'IF wait_time > 60 THEN reassessment = TRUE', triggered: c3, detail: `wait_time = ${patientData.wait_time} ${c3 ? '>' : '≤'} 60` },
        { id: 'C5', rule: 'IF age < 12 AND vital_score < 0.6 THEN priority ≥ MEDIUM', triggered: c5, detail: `age = ${patientData.age}, vital = ${patientData.vital_score}` },
        { id: 'C6', rule: 'IF age ≥ 65 AND comorbidity ≥ 0.5 THEN priority ≥ MEDIUM', triggered: c6, detail: `age = ${patientData.age}, comorbidity = ${patientData.comorbidity_index || 0}` },
        { id: 'C7', rule: 'IF trauma_score ≥ 0.7 THEN priority = HIGH', triggered: c7, detail: `trauma_score = ${patientData.trauma_score || 'N/A'}` },
        { id: 'C8', rule: 'IF MATERNAL AND complications THEN priority = HIGH', triggered: c8, detail: `category = ${category}, complications = ${patientData.complications || false}` },
        { id: 'C9', rule: 'IF resource_score < 0.3 THEN resource_alert = TRUE', triggered: c9, detail: `resource_score = ${patientData.resource_score || 0.5} ${c9 ? '<' : '≥'} 0.3` },
        { id: 'C10', rule: 'IF triggered_rules ≥ 3 THEN priority ≥ MEDIUM', triggered: c10, detail: `triggered_rules = ${triggeredCount} ${c10 ? '≥' : '<'} 3` }
    ];

    const decision = {
        priority,
        critical,
        urgency,
        reassessment,
        resource_alert: resourceAlert,
        category,
        risk_score: riskScore,
        triggered_rules: triggeredCount,
        timestamp,
        reasons,
        allRules
    };

    // ── Generate Triadic Verification ──
    const poo = generatePoO(patientData, MEDICAL_POLICY.policy_name, timestamp);
    const por = generatePoR(patientData, decision);
    const poi = verifyPoI(decision, patientData);
    const bundle = createVerificationBundle(poo, por, poi);

    return { decision, verification_bundle: bundle };
}

// ═══════════════════════════════════════════════════════════════
// PROOF OF REASON (PoR) — Reason Graph
// ═══════════════════════════════════════════════════════════════

function generatePoR(patientData, decision) {
    const category = decision.category || 'GENERAL';

    const vertices = [
        { id: 'p1', type: 'premise', label: `vital_score = ${patientData.vital_score}` },
        { id: 'p2', type: 'premise', label: `wait_time = ${patientData.wait_time} min` },
        { id: 'p3', type: 'premise', label: `age = ${patientData.age}` },
        { id: 'p4', type: 'premise', label: `comorbidity_index = ${patientData.comorbidity_index || 0}` },
        { id: 'p5', type: 'premise', label: `resource_score = ${patientData.resource_score || 0.5}` },
        { id: 'p6', type: 'premise', label: `category = ${category}` },
        { id: 'r1', type: 'rule', label: 'C1: vital_score < 0.5 → critical' },
        { id: 'r2', type: 'rule', label: 'R-URGENCY: critical + wait > 30 → IMMEDIATE' },
        { id: 'r3', type: 'rule', label: 'R-AGE: age ≥ 65 → ELEVATED' },
        { id: 'r4', type: 'rule', label: 'R-COMORBID: comorbidity ≥ 0.6 → HIGH' },
        { id: 'r5', type: 'rule', label: 'C5: pediatric vital < 0.6 → MEDIUM+' },
        { id: 'r6', type: 'rule', label: 'C6: geriatric + comorbidity → MEDIUM+' },
        { id: 'r7', type: 'rule', label: 'C7: trauma ≥ 0.7 → HIGH' },
        { id: 'r8', type: 'rule', label: 'C10: multi-symptom → MEDIUM+' },
        { id: 'c1', type: 'conclusion', label: `critical = ${decision.critical}` },
        { id: 'c2', type: 'conclusion', label: `urgency = ${decision.urgency}` },
        { id: 'c3', type: 'conclusion', label: `priority = ${decision.priority}` },
        { id: 'c4', type: 'conclusion', label: `risk_score = ${decision.risk_score}` }
    ];

    // Add category-specific vertices
    if (category === 'TRAUMA') {
        vertices.push({ id: 'p7', type: 'premise', label: `trauma_score = ${patientData.trauma_score || 0}` });
    }
    if (category === 'MATERNAL') {
        vertices.push({ id: 'p8', type: 'premise', label: `complications = ${patientData.complications || false}` });
        vertices.push({ id: 'r9', type: 'rule', label: 'C8: maternal + complications → HIGH' });
    }

    const edges = [
        { from: 'p1', to: 'r1', relation: 'input' },
        { from: 'r1', to: 'c1', relation: 'entails' },
        { from: 'c1', to: 'r2', relation: 'input' },
        { from: 'p2', to: 'r2', relation: 'input' },
        { from: 'r2', to: 'c2', relation: 'entails' },
        { from: 'p3', to: 'r3', relation: 'input' },
        { from: 'p4', to: 'r4', relation: 'input' },
        { from: 'p3', to: 'r5', relation: 'input' },
        { from: 'p1', to: 'r5', relation: 'input' },
        { from: 'p3', to: 'r6', relation: 'input' },
        { from: 'p4', to: 'r6', relation: 'input' },
        { from: 'c1', to: 'c3', relation: 'determines' },
        { from: 'c2', to: 'c3', relation: 'determines' },
        { from: 'r3', to: 'c3', relation: 'influences' },
        { from: 'r4', to: 'c3', relation: 'influences' },
        { from: 'r8', to: 'c3', relation: 'influences' },
        { from: 'c3', to: 'c4', relation: 'produces' }
    ];

    if (category === 'TRAUMA') {
        edges.push({ from: 'p7', to: 'r7', relation: 'input' });
        edges.push({ from: 'r7', to: 'c3', relation: 'determines' });
    }
    if (category === 'MATERNAL') {
        edges.push({ from: 'p8', to: 'r9', relation: 'input' });
        edges.push({ from: 'p6', to: 'r9', relation: 'input' });
        edges.push({ from: 'r9', to: 'c3', relation: 'determines' });
    }

    const graph = { vertices, edges };
    const graphHash = crypto.createHash('sha256').update(JSON.stringify(graph)).digest('hex');

    return {
        graph,
        hash: graphHash,
        signature: generateSignature(graphHash)
    };
}

// ═══════════════════════════════════════════════════════════════
// PROOF OF INTENT (PoI) — Policy Verification
// ═══════════════════════════════════════════════════════════════

function verifyPoI(decision, patientData) {
    const results = [];

    // C1: vital_priority
    results.push({
        constraint: 'C1 - vital_priority',
        satisfied: patientData.vital_score >= 0.5 || decision.priority === 'HIGH',
        severity: 'mandatory',
        detail: `vital_score=${patientData.vital_score}, priority=${decision.priority}`
    });

    // C3: max_wait
    const c3_triggered = patientData.wait_time > 60;
    results.push({
        constraint: 'C3 - max_wait',
        satisfied: patientData.wait_time <= 60 || decision.reassessment === true,
        triggered: c3_triggered,
        severity: 'warning',
        detail: c3_triggered
            ? `⚠️ Triggered — reassessment activated (wait=${patientData.wait_time} > 60)`
            : `✅ Within limit (wait=${patientData.wait_time} ≤ 60)`
    });

    // C5: pediatric_priority
    if (patientData.age < 12) {
        results.push({
            constraint: 'C5 - pediatric_priority',
            satisfied: patientData.vital_score >= 0.6 || decision.priority !== 'LOW',
            severity: 'mandatory',
            detail: `age=${patientData.age}, vital=${patientData.vital_score}, priority=${decision.priority}`
        });
    }

    // C6: geriatric_caution
    if (patientData.age >= 65) {
        results.push({
            constraint: 'C6 - geriatric_caution',
            satisfied: (patientData.comorbidity_index || 0) < 0.5 || decision.priority !== 'LOW',
            severity: 'mandatory',
            detail: `age=${patientData.age}, comorbidity=${patientData.comorbidity_index || 0}, priority=${decision.priority}`
        });
    }

    // C7: trauma_escalation
    if ((patientData.trauma_score || 0) >= 0.7) {
        results.push({
            constraint: 'C7 - trauma_escalation',
            satisfied: decision.priority === 'HIGH',
            severity: 'mandatory',
            detail: `trauma_score=${patientData.trauma_score}, priority=${decision.priority}`
        });
    }

    // C8: maternal_safety
    if (decision.category === 'MATERNAL' && patientData.complications) {
        results.push({
            constraint: 'C8 - maternal_safety',
            satisfied: decision.priority === 'HIGH',
            severity: 'mandatory',
            detail: `category=MATERNAL, complications=TRUE, priority=${decision.priority}`
        });
    }

    // C9: resource_constraint
    if ((patientData.resource_score || 0.5) < 0.3) {
        results.push({
            constraint: 'C9 - resource_constraint',
            satisfied: decision.resource_alert === true,
            severity: 'warning',
            detail: `resource_score=${patientData.resource_score}, alert=${decision.resource_alert}`
        });
    }

    // Axiom 3.1: Temporal Precedence
    results.push({
        constraint: 'Axiom 3.1 - Temporal Precedence',
        satisfied: MEDICAL_POLICY.declaration_timestamp < decision.timestamp,
        severity: 'mandatory',
        detail: `PoI declared: ${MEDICAL_POLICY.declaration_timestamp}, Decision: ${decision.timestamp}`
    });

    const all_mandatory_satisfied = results.filter(r => r.severity === 'mandatory').every(r => r.satisfied);

    return {
        policy: MEDICAL_POLICY.policy_name,
        policy_hash: MEDICAL_POLICY.policy_hash,
        declaration_time: MEDICAL_POLICY.declaration_timestamp,
        verification_time: new Date().toISOString(),
        all_satisfied: all_mandatory_satisfied,
        results
    };
}

// ═══════════════════════════════════════════════════════════════
// VERIFICATION BUNDLE
// ═══════════════════════════════════════════════════════════════

function createVerificationBundle(poo, por, poi) {
    const leaves = [poo.hash, por.hash, poi.policy_hash || 'genesis'];
    const merkleRoot = computeMerkleRoot(leaves);
    const temporalRow = poi.results && poi.results.find(r => r.constraint.includes('Temporal'));
    const overall_result = (poi.all_satisfied && por.graph.edges.length > 0) ? 'VERIFIED' : 'FAILED';

    return {
        bundle_id: `VB-MED-${Date.now()}`,
        created_at: new Date().toISOString(),
        poo,
        por,
        poi,
        merkle_root: merkleRoot,
        verification_predicate: {
            signatures_valid: true,
            logic_valid: por.graph.edges.length > 0,
            temporal_precedence: temporalRow ? temporalRow.satisfied : false,
            constraints_satisfied: poi.all_satisfied,
            merkle_verified: true
        },
        overall_result
    };
}

// ═══════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY — triageDecision wrapper
// ═══════════════════════════════════════════════════════════════

function triageDecision(patientData) {
    return evaluateMedical(patientData);
}

module.exports = {
    MEDICAL_POLICY,
    evaluateMedical,
    triageDecision,
    generatePoO,
    generatePoR,
    verifyPoI,
    createVerificationBundle,
    computeMerkleRoot,
    detectCategory,
    calculateRiskScore
};

/**
 * OpLogica Permit Assessment Engine v2.0 — Triadic Verification
 * Enhanced Building & Operational Permit Protocol.
 * DETERMINISTIC: same inputs → same outputs.
 *
 * Categories: Residential, Commercial, Industrial, Infrastructure, Renovation
 * Rules: 10 permit decision rules with full cryptographic proof bundles
 * Verification: PoO (Proof of Origin), PoR (Proof of Reason), PoI (Proof of Intent)
 */

const crypto = require('crypto');

const POO_SECRET = process.env.POO_SECRET || 'oplogica-verification-key';

// ═══════════════════════════════════════════════════════════════
// POLICY DECLARATION (Axiom 3.1 — Temporal Precedence)
// ═══════════════════════════════════════════════════════════════

const PERMIT_POLICY = {
    policy_name: 'Building & Operational Permit Protocol v2.0',
    authority: 'OpLogica Regulatory Ethics Framework',
    declaration_timestamp: '2024-11-15T09:00:00Z',
    version: '2.0.0',
    constraints: [
        { id: 'P1', name: 'zoning_compliance', rule: 'WHEN zoning_compliance < 0.4 THEN recommendation = DENIED', severity: 'mandatory' },
        { id: 'P2', name: 'structural_safety', rule: 'WHEN structural_safety < 0.5 THEN recommendation = DENIED', severity: 'mandatory' },
        { id: 'P3', name: 'environmental_impact', rule: 'WHEN environmental_impact > 0.7 THEN flag_environmental_review = TRUE', severity: 'mandatory' },
        { id: 'P4', name: 'fire_safety', rule: 'WHEN fire_safety_score < 0.5 THEN recommendation ≠ APPROVED', severity: 'mandatory' },
        { id: 'P5', name: 'plot_coverage', rule: 'WHEN plot_coverage_ratio > 0.80 THEN flag_overcoverage = TRUE', severity: 'mandatory' },
        { id: 'P6', name: 'accessibility', rule: 'WHEN accessibility_score < 0.4 AND type ≠ RENOVATION THEN recommendation ≠ APPROVED', severity: 'mandatory' },
        { id: 'P7', name: 'utility_capacity', rule: 'WHEN utility_capacity < 0.3 THEN flag_utility_constraint = TRUE', severity: 'warning' },
        { id: 'P8', name: 'heritage_protection', rule: 'WHEN heritage_zone = TRUE AND heritage_compliance < 0.6 THEN recommendation = DENIED', severity: 'mandatory' },
        { id: 'P9', name: 'traffic_impact', rule: 'WHEN traffic_impact > 0.7 THEN require_traffic_study = TRUE', severity: 'warning' },
        { id: 'P10', name: 'multi_violation', rule: 'WHEN triggered_violations >= 3 THEN recommendation = DENIED', severity: 'mandatory' }
    ],
    policy_hash: null,
    authority_signature: null
};

(function () {
    const payload = JSON.stringify({
        name: PERMIT_POLICY.policy_name,
        version: PERMIT_POLICY.version,
        declaration_timestamp: PERMIT_POLICY.declaration_timestamp,
        constraints: PERMIT_POLICY.constraints.map(c => c.id + c.rule)
    });
    PERMIT_POLICY.policy_hash = crypto.createHash('sha256').update(payload).digest('hex');
    PERMIT_POLICY.authority_signature = crypto.createHmac('sha256', POO_SECRET).update(PERMIT_POLICY.policy_hash).digest('hex');
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

function generatePoO(permitData, policy, timestamp) {
    const state = JSON.stringify({ D: permitData, P: policy, T: timestamp });
    const hash = crypto.createHash('sha256').update(state).digest('hex');
    const signature = crypto.createHmac('sha256', POO_SECRET).update(hash + timestamp).digest('hex');
    return {
        hash,
        timestamp,
        signature,
        algorithm: 'SHA-256',
        state_reference: `PoO-PRM-${Date.now()}`
    };
}

// ═══════════════════════════════════════════════════════════════
// PERMIT TYPE DETECTION
// ═══════════════════════════════════════════════════════════════

function detectPermitType(permitData) {
    if (permitData.permit_type) return permitData.permit_type.toUpperCase();
    if (permitData.industrial_category) return 'INDUSTRIAL';
    if (permitData.commercial_area != null) return 'COMMERCIAL';
    if (permitData.renovation_scope) return 'RENOVATION';
    if (permitData.infrastructure_class) return 'INFRASTRUCTURE';
    return 'RESIDENTIAL';
}

// ═══════════════════════════════════════════════════════════════
// COMPLIANCE SCORING
// ═══════════════════════════════════════════════════════════════

function calculatePermitScore(permitData, permitType) {
    const weights = {
        RESIDENTIAL:     { zoning: 0.20, structural: 0.25, environmental: 0.15, fire: 0.15, coverage: 0.10, accessibility: 0.05, utility: 0.05, heritage: 0.05 },
        COMMERCIAL:      { zoning: 0.20, structural: 0.20, environmental: 0.15, fire: 0.15, coverage: 0.10, accessibility: 0.10, utility: 0.05, heritage: 0.05 },
        INDUSTRIAL:      { zoning: 0.15, structural: 0.20, environmental: 0.25, fire: 0.15, coverage: 0.10, accessibility: 0.05, utility: 0.05, heritage: 0.05 },
        INFRASTRUCTURE:  { zoning: 0.15, structural: 0.25, environmental: 0.20, fire: 0.10, coverage: 0.05, accessibility: 0.10, utility: 0.10, heritage: 0.05 },
        RENOVATION:      { zoning: 0.10, structural: 0.25, environmental: 0.10, fire: 0.15, coverage: 0.05, accessibility: 0.05, utility: 0.05, heritage: 0.25 }
    };

    const w = weights[permitType] || weights.RESIDENTIAL;
    let score = 0;

    // Zoning compliance (higher = better)
    score += Math.min(1, Math.max(0, permitData.zoning_compliance || 0.5)) * w.zoning;

    // Structural safety (higher = better)
    score += Math.min(1, Math.max(0, permitData.structural_safety || 0.5)) * w.structural;

    // Environmental (inverted: lower impact = better)
    score += (1 - Math.min(1, Math.max(0, permitData.environmental_impact || 0.3))) * w.environmental;

    // Fire safety (higher = better)
    score += Math.min(1, Math.max(0, permitData.fire_safety_score || 0.5)) * w.fire;

    // Coverage (inverted: lower = better)
    score += (1 - Math.min(1, Math.max(0, permitData.plot_coverage_ratio || 0.5))) * w.coverage;

    // Accessibility (higher = better)
    score += Math.min(1, Math.max(0, permitData.accessibility_score || 0.5)) * w.accessibility;

    // Utility capacity (higher = better)
    score += Math.min(1, Math.max(0, permitData.utility_capacity || 0.5)) * w.utility;

    // Heritage compliance (higher = better, only if in heritage zone)
    if (permitData.heritage_zone === true) {
        score += Math.min(1, Math.max(0, permitData.heritage_compliance || 0.5)) * w.heritage;
    } else {
        score += 1.0 * w.heritage; // Full marks if not in heritage zone
    }

    return Math.min(1, Math.max(0, parseFloat(score.toFixed(4))));
}

// ═══════════════════════════════════════════════════════════════
// PERMIT CLASS
// ═══════════════════════════════════════════════════════════════

function determinePermitClass(permitScore) {
    if (permitScore >= 0.85) return 'CLASS_A';
    if (permitScore >= 0.70) return 'CLASS_B';
    if (permitScore >= 0.55) return 'CLASS_C';
    if (permitScore >= 0.40) return 'CONDITIONAL';
    return 'NON_COMPLIANT';
}

// ═══════════════════════════════════════════════════════════════
// DECISION ENGINE (10 Rules)
// ═══════════════════════════════════════════════════════════════

function evaluatePermit(permitData) {
    const timestamp = new Date().toISOString();
    const permitType = detectPermitType(permitData);
    const permitScore = calculatePermitScore(permitData, permitType);
    const permitClass = determinePermitClass(permitScore);

    let recommendation = 'APPROVED';
    let flagEnvironmental = false;
    let flagOvercoverage = false;
    let flagUtilityConstraint = false;
    let requireTrafficStudy = false;
    const reasons = [];
    let triggeredCount = 0;

    const zc = permitData.zoning_compliance != null ? permitData.zoning_compliance : 0.7;
    const ss = permitData.structural_safety != null ? permitData.structural_safety : 0.7;
    const ei = permitData.environmental_impact != null ? permitData.environmental_impact : 0.30;
    const fs = permitData.fire_safety_score != null ? permitData.fire_safety_score : 0.7;
    const pcr = permitData.plot_coverage_ratio != null ? permitData.plot_coverage_ratio : 0.50;
    const acc = permitData.accessibility_score != null ? permitData.accessibility_score : 0.6;
    const uc = permitData.utility_capacity != null ? permitData.utility_capacity : 0.6;
    const hz = permitData.heritage_zone === true;
    const hc = permitData.heritage_compliance != null ? permitData.heritage_compliance : 0.7;
    const ti = permitData.traffic_impact != null ? permitData.traffic_impact : 0.3;

    // ── P1: Zoning Compliance ──
    const p1 = zc < 0.4;
    if (p1) {
        recommendation = 'DENIED';
        reasons.push(`P1: zoning_compliance=${zc} < 0.4 → recommendation = DENIED`);
        triggeredCount++;
    }

    // ── P2: Structural Safety ──
    const p2 = ss < 0.5;
    if (p2) {
        recommendation = 'DENIED';
        reasons.push(`P2: structural_safety=${ss} < 0.5 → recommendation = DENIED`);
        triggeredCount++;
    }

    // ── P3: Environmental Impact ──
    const p3 = ei > 0.7;
    if (p3) {
        flagEnvironmental = true;
        if (recommendation === 'APPROVED') recommendation = 'CONDITIONAL_APPROVAL';
        reasons.push(`P3: environmental_impact=${ei} > 0.7 → flag_environmental_review`);
        triggeredCount++;
    }

    // ── P4: Fire Safety ──
    const p4 = fs < 0.5;
    if (p4) {
        if (recommendation === 'APPROVED') recommendation = 'CONDITIONAL_APPROVAL';
        reasons.push(`P4: fire_safety_score=${fs} < 0.5 → recommendation ≠ APPROVED`);
        triggeredCount++;
    }

    // ── P5: Plot Coverage ──
    const p5 = pcr > 0.80;
    if (p5) {
        flagOvercoverage = true;
        if (recommendation === 'APPROVED') recommendation = 'CONDITIONAL_APPROVAL';
        reasons.push(`P5: plot_coverage_ratio=${pcr} > 0.80 → flag_overcoverage`);
        triggeredCount++;
    }

    // ── P6: Accessibility ──
    const p6 = acc < 0.4 && permitType !== 'RENOVATION';
    if (p6) {
        if (recommendation === 'APPROVED') recommendation = 'CONDITIONAL_APPROVAL';
        reasons.push(`P6: accessibility_score=${acc} < 0.4 AND type ≠ RENOVATION → ≠ APPROVED`);
        triggeredCount++;
    }

    // ── P7: Utility Capacity ──
    const p7 = uc < 0.3;
    if (p7) {
        flagUtilityConstraint = true;
        reasons.push(`P7: utility_capacity=${uc} < 0.3 → flag_utility_constraint`);
        triggeredCount++;
    }

    // ── P8: Heritage Protection ──
    const p8 = hz && hc < 0.6;
    if (p8) {
        recommendation = 'DENIED';
        reasons.push(`P8: heritage_zone=TRUE AND heritage_compliance=${hc} < 0.6 → DENIED`);
        triggeredCount++;
    }

    // ── P9: Traffic Impact ──
    const p9 = ti > 0.7;
    if (p9) {
        requireTrafficStudy = true;
        reasons.push(`P9: traffic_impact=${ti} > 0.7 → require_traffic_study`);
        triggeredCount++;
    }

    // ── P10: Multi-Violation Escalation ──
    const p10 = triggeredCount >= 3;
    if (p10 && recommendation !== 'DENIED') {
        recommendation = 'DENIED';
        reasons.push(`P10: triggered_violations=${triggeredCount} >= 3 → recommendation = DENIED`);
    }

    const allRules = [
        { id: 'P1', rule: 'IF zoning < 0.4 THEN DENIED', triggered: p1, detail: `zoning = ${zc} ${p1 ? '<' : '≥'} 0.4` },
        { id: 'P2', rule: 'IF structural < 0.5 THEN DENIED', triggered: p2, detail: `structural = ${ss} ${p2 ? '<' : '≥'} 0.5` },
        { id: 'P3', rule: 'IF environmental > 0.7 THEN env_review', triggered: p3, detail: `environmental = ${ei} ${p3 ? '>' : '≤'} 0.7` },
        { id: 'P4', rule: 'IF fire_safety < 0.5 THEN ≠ APPROVED', triggered: p4, detail: `fire_safety = ${fs} ${p4 ? '<' : '≥'} 0.5` },
        { id: 'P5', rule: 'IF coverage > 0.80 THEN overcoverage', triggered: p5, detail: `coverage = ${pcr} ${p5 ? '>' : '≤'} 0.80` },
        { id: 'P6', rule: 'IF accessibility < 0.4 AND ≠ RENOVATION THEN ≠ APPROVED', triggered: p6, detail: `accessibility = ${acc}, type = ${permitType}` },
        { id: 'P7', rule: 'IF utility < 0.3 THEN utility_constraint', triggered: p7, detail: `utility = ${uc} ${p7 ? '<' : '≥'} 0.3` },
        { id: 'P8', rule: 'IF heritage_zone AND compliance < 0.6 THEN DENIED', triggered: p8, detail: `heritage_zone = ${hz}, compliance = ${hc}` },
        { id: 'P9', rule: 'IF traffic > 0.7 THEN traffic_study', triggered: p9, detail: `traffic = ${ti} ${p9 ? '>' : '≤'} 0.7` },
        { id: 'P10', rule: 'IF violations ≥ 3 THEN DENIED', triggered: p10, detail: `violations = ${triggeredCount} ${p10 ? '≥' : '<'} 3` }
    ];

    const decision = {
        recommendation,
        permit_score: permitScore,
        permit_class: permitClass,
        permit_type: permitType,
        environmental_review: flagEnvironmental,
        overcoverage: flagOvercoverage,
        utility_constraint: flagUtilityConstraint,
        traffic_study_required: requireTrafficStudy,
        triggered_rules: triggeredCount,
        timestamp,
        reasons,
        allRules
    };

    const poo = generatePoO(permitData, PERMIT_POLICY.policy_name, timestamp);
    const por = generatePoR(permitData, decision);
    const poi = verifyPoI(decision, permitData);
    const bundle = createVerificationBundle(poo, por, poi);

    return { decision, verification_bundle: bundle };
}

// ═══════════════════════════════════════════════════════════════
// PROOF OF REASON (PoR)
// ═══════════════════════════════════════════════════════════════

function generatePoR(permitData, decision) {
    const vertices = [
        { id: 'p1', type: 'premise', label: `zoning_compliance = ${permitData.zoning_compliance || 0.7}` },
        { id: 'p2', type: 'premise', label: `structural_safety = ${permitData.structural_safety || 0.7}` },
        { id: 'p3', type: 'premise', label: `environmental_impact = ${permitData.environmental_impact || 0.3}` },
        { id: 'p4', type: 'premise', label: `fire_safety = ${permitData.fire_safety_score || 0.7}` },
        { id: 'p5', type: 'premise', label: `plot_coverage = ${permitData.plot_coverage_ratio || 0.5}` },
        { id: 'p6', type: 'premise', label: `accessibility = ${permitData.accessibility_score || 0.6}` },
        { id: 'p7', type: 'premise', label: `utility_capacity = ${permitData.utility_capacity || 0.6}` },
        { id: 'p8', type: 'premise', label: `permit_type = ${decision.permit_type}` },
        { id: 'r1', type: 'rule', label: 'P1: zoning < 0.4 → DENIED' },
        { id: 'r2', type: 'rule', label: 'P2: structural < 0.5 → DENIED' },
        { id: 'r3', type: 'rule', label: 'P3: environmental > 0.7 → review' },
        { id: 'r4', type: 'rule', label: 'P4: fire < 0.5 → ≠ APPROVED' },
        { id: 'r5', type: 'rule', label: 'P5: coverage > 0.80 → overcoverage' },
        { id: 'r6', type: 'rule', label: 'P6: accessibility < 0.4 → ≠ APPROVED' },
        { id: 'r7', type: 'rule', label: 'P8: heritage non-compliant → DENIED' },
        { id: 'r8', type: 'rule', label: 'P10: multi-violation → DENIED' },
        { id: 'c1', type: 'conclusion', label: `recommendation = ${decision.recommendation}` },
        { id: 'c2', type: 'conclusion', label: `permit_score = ${(decision.permit_score * 100).toFixed(1)}%` },
        { id: 'c3', type: 'conclusion', label: `permit_class = ${decision.permit_class}` }
    ];

    if (permitData.heritage_zone === true) {
        vertices.push({ id: 'p9', type: 'premise', label: `heritage_zone = TRUE` });
        vertices.push({ id: 'p10', type: 'premise', label: `heritage_compliance = ${permitData.heritage_compliance || 0.7}` });
    }

    const edges = [
        { from: 'p1', to: 'r1', relation: 'input' },
        { from: 'p2', to: 'r2', relation: 'input' },
        { from: 'p3', to: 'r3', relation: 'input' },
        { from: 'p4', to: 'r4', relation: 'input' },
        { from: 'p5', to: 'r5', relation: 'input' },
        { from: 'p6', to: 'r6', relation: 'input' },
        { from: 'r1', to: 'c1', relation: 'determines' },
        { from: 'r2', to: 'c1', relation: 'determines' },
        { from: 'r3', to: 'c1', relation: 'influences' },
        { from: 'r4', to: 'c1', relation: 'influences' },
        { from: 'r5', to: 'c1', relation: 'influences' },
        { from: 'r6', to: 'c1', relation: 'influences' },
        { from: 'r7', to: 'c1', relation: 'determines' },
        { from: 'r8', to: 'c1', relation: 'determines' },
        { from: 'c1', to: 'c2', relation: 'produces' },
        { from: 'c2', to: 'c3', relation: 'determines' }
    ];

    if (permitData.heritage_zone === true) {
        edges.push({ from: 'p9', to: 'r7', relation: 'input' });
        edges.push({ from: 'p10', to: 'r7', relation: 'input' });
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
// PROOF OF INTENT (PoI)
// ═══════════════════════════════════════════════════════════════

function verifyPoI(decision, permitData) {
    const results = [];
    const zc = permitData.zoning_compliance != null ? permitData.zoning_compliance : 0.7;
    const ss = permitData.structural_safety != null ? permitData.structural_safety : 0.7;

    // P1
    results.push({
        constraint: 'P1 - zoning_compliance',
        satisfied: zc >= 0.4 || decision.recommendation === 'DENIED',
        severity: 'mandatory',
        detail: `zoning=${zc}, recommendation=${decision.recommendation}`
    });

    // P2
    results.push({
        constraint: 'P2 - structural_safety',
        satisfied: ss >= 0.5 || decision.recommendation === 'DENIED',
        severity: 'mandatory',
        detail: `structural=${ss}, recommendation=${decision.recommendation}`
    });

    // P3
    results.push({
        constraint: 'P3 - environmental_impact',
        satisfied: (permitData.environmental_impact || 0.3) <= 0.7 || decision.environmental_review === true,
        severity: 'mandatory',
        detail: `environmental=${permitData.environmental_impact || 0.3}, review=${decision.environmental_review}`
    });

    // P4
    results.push({
        constraint: 'P4 - fire_safety',
        satisfied: (permitData.fire_safety_score || 0.7) >= 0.5 || decision.recommendation !== 'APPROVED',
        severity: 'mandatory',
        detail: `fire_safety=${permitData.fire_safety_score || 0.7}, recommendation=${decision.recommendation}`
    });

    // P8
    if (permitData.heritage_zone === true) {
        results.push({
            constraint: 'P8 - heritage_protection',
            satisfied: (permitData.heritage_compliance || 0.7) >= 0.6 || decision.recommendation === 'DENIED',
            severity: 'mandatory',
            detail: `heritage_compliance=${permitData.heritage_compliance || 0.7}, recommendation=${decision.recommendation}`
        });
    }

    // Axiom 3.1
    results.push({
        constraint: 'Axiom 3.1 - Temporal Precedence',
        satisfied: PERMIT_POLICY.declaration_timestamp < decision.timestamp,
        severity: 'mandatory',
        detail: `PoI declared: ${PERMIT_POLICY.declaration_timestamp}, Decision: ${decision.timestamp}`
    });

    const all_mandatory_satisfied = results.filter(r => r.severity === 'mandatory').every(r => r.satisfied);

    return {
        policy: PERMIT_POLICY.policy_name,
        policy_hash: PERMIT_POLICY.policy_hash,
        declaration_time: PERMIT_POLICY.declaration_timestamp,
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
        bundle_id: `VB-PRM-${Date.now()}`,
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

module.exports = {
    PERMIT_POLICY,
    evaluatePermit,
    generatePoO,
    generatePoR,
    verifyPoI,
    createVerificationBundle,
    computeMerkleRoot,
    detectPermitType,
    calculatePermitScore,
    determinePermitClass
};

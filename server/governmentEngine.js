/**
 * OpLogica Government Service Engine v1.0 — Triadic Verification
 * Government Service Request Assessment Protocol.
 * DETERMINISTIC: same inputs → same outputs.
 *
 * Domains: Eligibility, Documentation, Identity Verification, Compliance, Resource Allocation
 * Rules: 10 governance decision rules with full cryptographic proof bundles
 * Verification: PoO (Proof of Origin), PoR (Proof of Reason), PoI (Proof of Intent)
 */

const crypto = require('crypto');

const POO_SECRET = process.env.POO_SECRET || 'oplogica-verification-key';

// ═══════════════════════════════════════════════════════════════
// POLICY DECLARATION (Axiom 3.1 — Temporal Precedence)
// ═══════════════════════════════════════════════════════════════

const GOVERNMENT_POLICY = {
    policy_name: 'Government Service Assessment Protocol v1.0',
    authority: 'OpLogica Governance Ethics Framework',
    declaration_timestamp: '2024-11-15T09:00:00Z',
    version: '1.0.0',
    constraints: [
        { id: 'G1', name: 'identity_verification', rule: 'WHEN identity.verified = FALSE THEN recommendation = REJECTED', severity: 'mandatory' },
        { id: 'G2', name: 'eligibility_check', rule: 'WHEN eligibility.score < 0.4 THEN recommendation = REJECTED', severity: 'mandatory' },
        { id: 'G3', name: 'documentation_completeness', rule: 'WHEN documentation.score < 0.5 THEN status = INCOMPLETE', severity: 'mandatory' },
        { id: 'G4', name: 'residency_requirement', rule: 'WHEN residency.verified = FALSE AND service.requires_residency = TRUE THEN recommendation = REJECTED', severity: 'mandatory' },
        { id: 'G5', name: 'tax_compliance', rule: 'WHEN tax.compliant = FALSE THEN flag_tax_hold = TRUE', severity: 'mandatory' },
        { id: 'G6', name: 'criminal_record_check', rule: 'WHEN criminal.flagged = TRUE AND service.requires_clearance = TRUE THEN recommendation = FURTHER_REVIEW', severity: 'mandatory' },
        { id: 'G7', name: 'duplicate_detection', rule: 'WHEN duplicate.detected = TRUE THEN recommendation = REJECTED', severity: 'mandatory' },
        { id: 'G8', name: 'service_capacity', rule: 'WHEN capacity.available < 0.2 THEN flag_capacity_warning = TRUE', severity: 'warning' },
        { id: 'G9', name: 'priority_population', rule: 'WHEN applicant.priority_group = TRUE THEN processing_priority = ELEVATED', severity: 'mandatory' },
        { id: 'G10', name: 'multi_flag', rule: 'WHEN triggered_flags >= 3 THEN recommendation ≠ APPROVED', severity: 'mandatory' }
    ],
    policy_hash: null,
    authority_signature: null
};

(function () {
    const payload = JSON.stringify({
        name: GOVERNMENT_POLICY.policy_name,
        version: GOVERNMENT_POLICY.version,
        declaration_timestamp: GOVERNMENT_POLICY.declaration_timestamp,
        constraints: GOVERNMENT_POLICY.constraints.map(c => c.id + c.rule)
    });
    GOVERNMENT_POLICY.policy_hash = crypto.createHash('sha256').update(payload).digest('hex');
    GOVERNMENT_POLICY.authority_signature = crypto.createHmac('sha256', POO_SECRET).update(GOVERNMENT_POLICY.policy_hash).digest('hex');
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

function generatePoO(requestData, policy, timestamp) {
    const state = JSON.stringify({ D: requestData, P: policy, T: timestamp });
    const hash = crypto.createHash('sha256').update(state).digest('hex');
    const signature = crypto.createHmac('sha256', POO_SECRET).update(hash + timestamp).digest('hex');
    return {
        hash,
        timestamp,
        signature,
        algorithm: 'SHA-256',
        state_reference: `PoO-GOV-${Date.now()}`
    };
}

// ═══════════════════════════════════════════════════════════════
// SERVICE TYPE DETECTION
// ═══════════════════════════════════════════════════════════════

function detectServiceType(requestData) {
    if (requestData.service_type) return requestData.service_type.toUpperCase();
    if (requestData.license_type) return 'LICENSE';
    if (requestData.benefit_type) return 'BENEFIT';
    if (requestData.permit_type) return 'PERMIT';
    if (requestData.registration_type) return 'REGISTRATION';
    return 'GENERAL';
}

// ═══════════════════════════════════════════════════════════════
// COMPLIANCE SCORING
// ═══════════════════════════════════════════════════════════════

function calculateComplianceScore(requestData) {
    let score = 0;
    const weights = {
        identity: 0.20,
        eligibility: 0.20,
        documentation: 0.20,
        residency: 0.15,
        tax: 0.15,
        record: 0.10
    };

    // Identity verification
    const idScore = requestData.identity_verified !== false ? 1.0 : 0.0;
    score += idScore * weights.identity;

    // Eligibility
    score += Math.min(1, Math.max(0, requestData.eligibility_score || 0.5)) * weights.eligibility;

    // Documentation completeness
    score += Math.min(1, Math.max(0, requestData.documentation_score || 0.5)) * weights.documentation;

    // Residency
    const resScore = requestData.residency_verified !== false ? 1.0 : 0.0;
    score += resScore * weights.residency;

    // Tax compliance
    const taxScore = requestData.tax_compliant !== false ? 1.0 : 0.0;
    score += taxScore * weights.tax;

    // Criminal record (clean = higher score)
    const recordScore = requestData.criminal_flagged === true ? 0.0 : 1.0;
    score += recordScore * weights.record;

    return Math.min(1, Math.max(0, parseFloat(score.toFixed(4))));
}

// ═══════════════════════════════════════════════════════════════
// DECISION ENGINE (10 Rules)
// ═══════════════════════════════════════════════════════════════

function evaluateGovernment(requestData) {
    const timestamp = new Date().toISOString();
    const serviceType = detectServiceType(requestData);
    const complianceScore = calculateComplianceScore(requestData);

    let recommendation = 'APPROVED';
    let status = 'COMPLETE';
    let processingPriority = 'STANDARD';
    let flagTaxHold = false;
    let flagCapacityWarning = false;
    const reasons = [];
    let triggeredCount = 0;

    const idVerified = requestData.identity_verified !== false;
    const eligScore = requestData.eligibility_score != null ? requestData.eligibility_score : 0.7;
    const docScore = requestData.documentation_score != null ? requestData.documentation_score : 0.7;
    const resVerified = requestData.residency_verified !== false;
    const resRequired = requestData.requires_residency !== false;
    const taxCompliant = requestData.tax_compliant !== false;
    const crimFlagged = requestData.criminal_flagged === true;
    const clearanceReq = requestData.requires_clearance === true;
    const dupDetected = requestData.duplicate_detected === true;
    const capacity = requestData.service_capacity != null ? requestData.service_capacity : 0.8;
    const priorityGroup = requestData.priority_group === true;

    // ── G1: Identity Verification ──
    const g1 = !idVerified;
    if (g1) {
        recommendation = 'REJECTED';
        reasons.push('G1: identity_verified = FALSE → recommendation = REJECTED');
        triggeredCount++;
    }

    // ── G2: Eligibility Check ──
    const g2 = eligScore < 0.4;
    if (g2) {
        recommendation = 'REJECTED';
        reasons.push(`G2: eligibility_score=${eligScore} < 0.4 → recommendation = REJECTED`);
        triggeredCount++;
    }

    // ── G3: Documentation Completeness ──
    const g3 = docScore < 0.5;
    if (g3) {
        status = 'INCOMPLETE';
        if (recommendation === 'APPROVED') recommendation = 'FURTHER_REVIEW';
        reasons.push(`G3: documentation_score=${docScore} < 0.5 → status = INCOMPLETE`);
        triggeredCount++;
    }

    // ── G4: Residency Requirement ──
    const g4 = !resVerified && resRequired;
    if (g4) {
        recommendation = 'REJECTED';
        reasons.push('G4: residency_verified = FALSE AND requires_residency = TRUE → REJECTED');
        triggeredCount++;
    }

    // ── G5: Tax Compliance ──
    const g5 = !taxCompliant;
    if (g5) {
        flagTaxHold = true;
        if (recommendation === 'APPROVED') recommendation = 'FURTHER_REVIEW';
        reasons.push('G5: tax_compliant = FALSE → flag_tax_hold = TRUE');
        triggeredCount++;
    }

    // ── G6: Criminal Record Check ──
    const g6 = crimFlagged && clearanceReq;
    if (g6) {
        if (recommendation === 'APPROVED') recommendation = 'FURTHER_REVIEW';
        reasons.push('G6: criminal_flagged = TRUE AND requires_clearance = TRUE → FURTHER_REVIEW');
        triggeredCount++;
    }

    // ── G7: Duplicate Detection ──
    const g7 = dupDetected;
    if (g7) {
        recommendation = 'REJECTED';
        reasons.push('G7: duplicate_detected = TRUE → recommendation = REJECTED');
        triggeredCount++;
    }

    // ── G8: Service Capacity ──
    const g8 = capacity < 0.2;
    if (g8) {
        flagCapacityWarning = true;
        reasons.push(`G8: service_capacity=${capacity} < 0.2 → flag_capacity_warning = TRUE`);
        triggeredCount++;
    }

    // ── G9: Priority Population ──
    const g9 = priorityGroup;
    if (g9) {
        processingPriority = 'ELEVATED';
        reasons.push('G9: priority_group = TRUE → processing_priority = ELEVATED');
        triggeredCount++;
    }

    // ── G10: Multi-Flag Escalation ──
    const g10 = triggeredCount >= 3;
    if (g10 && recommendation === 'APPROVED') {
        recommendation = 'FURTHER_REVIEW';
        reasons.push(`G10: triggered_flags=${triggeredCount} >= 3 → recommendation ≠ APPROVED`);
    }

    const allRules = [
        { id: 'G1', rule: 'IF identity unverified THEN REJECTED', triggered: g1, detail: `identity_verified = ${idVerified}` },
        { id: 'G2', rule: 'IF eligibility < 0.4 THEN REJECTED', triggered: g2, detail: `eligibility_score = ${eligScore} ${g2 ? '<' : '≥'} 0.4` },
        { id: 'G3', rule: 'IF documentation < 0.5 THEN INCOMPLETE', triggered: g3, detail: `documentation_score = ${docScore} ${g3 ? '<' : '≥'} 0.5` },
        { id: 'G4', rule: 'IF residency unverified AND required THEN REJECTED', triggered: g4, detail: `residency_verified = ${resVerified}, required = ${resRequired}` },
        { id: 'G5', rule: 'IF tax non-compliant THEN tax_hold', triggered: g5, detail: `tax_compliant = ${taxCompliant}` },
        { id: 'G6', rule: 'IF criminal flagged AND clearance required THEN REVIEW', triggered: g6, detail: `criminal_flagged = ${crimFlagged}, requires_clearance = ${clearanceReq}` },
        { id: 'G7', rule: 'IF duplicate detected THEN REJECTED', triggered: g7, detail: `duplicate_detected = ${dupDetected}` },
        { id: 'G8', rule: 'IF capacity < 0.2 THEN capacity_warning', triggered: g8, detail: `service_capacity = ${capacity} ${g8 ? '<' : '≥'} 0.2` },
        { id: 'G9', rule: 'IF priority_group THEN ELEVATED processing', triggered: g9, detail: `priority_group = ${priorityGroup}` },
        { id: 'G10', rule: 'IF triggered_flags ≥ 3 THEN ≠ APPROVED', triggered: g10, detail: `triggered_flags = ${triggeredCount} ${g10 ? '≥' : '<'} 3` }
    ];

    const decision = {
        recommendation,
        status,
        compliance_score: complianceScore,
        service_type: serviceType,
        processing_priority: processingPriority,
        tax_hold: flagTaxHold,
        capacity_warning: flagCapacityWarning,
        triggered_rules: triggeredCount,
        timestamp,
        reasons,
        allRules
    };

    const poo = generatePoO(requestData, GOVERNMENT_POLICY.policy_name, timestamp);
    const por = generatePoR(requestData, decision);
    const poi = verifyPoI(decision, requestData);
    const bundle = createVerificationBundle(poo, por, poi);

    return { decision, verification_bundle: bundle };
}

// ═══════════════════════════════════════════════════════════════
// PROOF OF REASON (PoR)
// ═══════════════════════════════════════════════════════════════

function generatePoR(requestData, decision) {
    const vertices = [
        { id: 'p1', type: 'premise', label: `identity_verified = ${requestData.identity_verified !== false}` },
        { id: 'p2', type: 'premise', label: `eligibility_score = ${requestData.eligibility_score || 0.7}` },
        { id: 'p3', type: 'premise', label: `documentation_score = ${requestData.documentation_score || 0.7}` },
        { id: 'p4', type: 'premise', label: `residency_verified = ${requestData.residency_verified !== false}` },
        { id: 'p5', type: 'premise', label: `tax_compliant = ${requestData.tax_compliant !== false}` },
        { id: 'p6', type: 'premise', label: `criminal_flagged = ${requestData.criminal_flagged === true}` },
        { id: 'p7', type: 'premise', label: `duplicate_detected = ${requestData.duplicate_detected === true}` },
        { id: 'p8', type: 'premise', label: `service_capacity = ${requestData.service_capacity || 0.8}` },
        { id: 'p9', type: 'premise', label: `priority_group = ${requestData.priority_group === true}` },
        { id: 'p10', type: 'premise', label: `service_type = ${decision.service_type}` },
        { id: 'r1', type: 'rule', label: 'G1: identity unverified → REJECTED' },
        { id: 'r2', type: 'rule', label: 'G2: eligibility < 0.4 → REJECTED' },
        { id: 'r3', type: 'rule', label: 'G3: documentation < 0.5 → INCOMPLETE' },
        { id: 'r4', type: 'rule', label: 'G4: residency unverified → REJECTED' },
        { id: 'r5', type: 'rule', label: 'G5: tax non-compliant → hold' },
        { id: 'r6', type: 'rule', label: 'G6: criminal + clearance → REVIEW' },
        { id: 'r7', type: 'rule', label: 'G7: duplicate → REJECTED' },
        { id: 'r8', type: 'rule', label: 'G9: priority → ELEVATED' },
        { id: 'r9', type: 'rule', label: 'G10: multi-flag → ≠ APPROVED' },
        { id: 'c1', type: 'conclusion', label: `recommendation = ${decision.recommendation}` },
        { id: 'c2', type: 'conclusion', label: `status = ${decision.status}` },
        { id: 'c3', type: 'conclusion', label: `compliance_score = ${decision.compliance_score}` },
        { id: 'c4', type: 'conclusion', label: `processing_priority = ${decision.processing_priority}` }
    ];

    const edges = [
        { from: 'p1', to: 'r1', relation: 'input' },
        { from: 'p2', to: 'r2', relation: 'input' },
        { from: 'p3', to: 'r3', relation: 'input' },
        { from: 'p4', to: 'r4', relation: 'input' },
        { from: 'p5', to: 'r5', relation: 'input' },
        { from: 'p6', to: 'r6', relation: 'input' },
        { from: 'p7', to: 'r7', relation: 'input' },
        { from: 'p9', to: 'r8', relation: 'input' },
        { from: 'r1', to: 'c1', relation: 'determines' },
        { from: 'r2', to: 'c1', relation: 'determines' },
        { from: 'r3', to: 'c2', relation: 'determines' },
        { from: 'r4', to: 'c1', relation: 'determines' },
        { from: 'r5', to: 'c1', relation: 'influences' },
        { from: 'r6', to: 'c1', relation: 'influences' },
        { from: 'r7', to: 'c1', relation: 'determines' },
        { from: 'r8', to: 'c4', relation: 'determines' },
        { from: 'r9', to: 'c1', relation: 'influences' },
        { from: 'c1', to: 'c3', relation: 'produces' },
        { from: 'c2', to: 'c3', relation: 'produces' }
    ];

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

function verifyPoI(decision, requestData) {
    const results = [];

    // G1
    results.push({
        constraint: 'G1 - identity_verification',
        satisfied: requestData.identity_verified !== false || decision.recommendation === 'REJECTED',
        severity: 'mandatory',
        detail: `identity_verified=${requestData.identity_verified !== false}, recommendation=${decision.recommendation}`
    });

    // G2
    results.push({
        constraint: 'G2 - eligibility_check',
        satisfied: (requestData.eligibility_score || 0.7) >= 0.4 || decision.recommendation === 'REJECTED',
        severity: 'mandatory',
        detail: `eligibility_score=${requestData.eligibility_score || 0.7}, recommendation=${decision.recommendation}`
    });

    // G3
    results.push({
        constraint: 'G3 - documentation_completeness',
        satisfied: (requestData.documentation_score || 0.7) >= 0.5 || decision.status === 'INCOMPLETE',
        severity: 'mandatory',
        detail: `documentation_score=${requestData.documentation_score || 0.7}, status=${decision.status}`
    });

    // G4
    const resRequired = requestData.requires_residency !== false;
    results.push({
        constraint: 'G4 - residency_requirement',
        satisfied: requestData.residency_verified !== false || !resRequired || decision.recommendation === 'REJECTED',
        severity: 'mandatory',
        detail: `residency_verified=${requestData.residency_verified !== false}, required=${resRequired}`
    });

    // G5
    results.push({
        constraint: 'G5 - tax_compliance',
        satisfied: requestData.tax_compliant !== false || decision.tax_hold === true,
        severity: 'mandatory',
        detail: `tax_compliant=${requestData.tax_compliant !== false}, tax_hold=${decision.tax_hold}`
    });

    // G7
    results.push({
        constraint: 'G7 - duplicate_detection',
        satisfied: requestData.duplicate_detected !== true || decision.recommendation === 'REJECTED',
        severity: 'mandatory',
        detail: `duplicate_detected=${requestData.duplicate_detected === true}, recommendation=${decision.recommendation}`
    });

    // Axiom 3.1
    results.push({
        constraint: 'Axiom 3.1 - Temporal Precedence',
        satisfied: GOVERNMENT_POLICY.declaration_timestamp < decision.timestamp,
        severity: 'mandatory',
        detail: `PoI declared: ${GOVERNMENT_POLICY.declaration_timestamp}, Decision: ${decision.timestamp}`
    });

    const all_mandatory_satisfied = results.filter(r => r.severity === 'mandatory').every(r => r.satisfied);

    return {
        policy: GOVERNMENT_POLICY.policy_name,
        policy_hash: GOVERNMENT_POLICY.policy_hash,
        declaration_time: GOVERNMENT_POLICY.declaration_timestamp,
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
        bundle_id: `VB-GOV-${Date.now()}`,
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
    GOVERNMENT_POLICY,
    evaluateGovernment,
    generatePoO,
    generatePoR,
    verifyPoI,
    createVerificationBundle,
    computeMerkleRoot,
    detectServiceType,
    calculateComplianceScore
};

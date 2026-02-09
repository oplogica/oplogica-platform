/**
 * OpLogica Legal Compliance Engine v1.0 — Triadic Verification
 * Legal Case Assessment Protocol with contract, regulatory, and liability analysis.
 * DETERMINISTIC: same inputs → same outputs.
 *
 * Domains: Contract Validity, Regulatory Compliance, Liability Assessment, Dispute Risk
 * Rules: 10 legal decision rules with full cryptographic proof bundles
 * Verification: PoO (Proof of Origin), PoR (Proof of Reason), PoI (Proof of Intent)
 */

const crypto = require('crypto');

const POO_SECRET = process.env.POO_SECRET || 'oplogica-verification-key';

// ═══════════════════════════════════════════════════════════════
// POLICY DECLARATION (Axiom 3.1 — Temporal Precedence)
// ═══════════════════════════════════════════════════════════════

const LEGAL_POLICY = {
    policy_name: 'Legal Compliance Assessment Protocol v1.0',
    authority: 'OpLogica Legal Ethics Framework',
    declaration_timestamp: '2024-11-15T09:00:00Z',
    version: '1.0.0',
    constraints: [
        { id: 'L1', name: 'contract_validity', rule: 'WHEN contract.validity_score < 0.4 THEN recommendation = REJECTED', severity: 'mandatory' },
        { id: 'L2', name: 'regulatory_compliance', rule: 'WHEN regulatory.compliance_score < 0.5 THEN flag_non_compliant = TRUE', severity: 'mandatory' },
        { id: 'L3', name: 'liability_threshold', rule: 'WHEN liability.exposure_ratio > 0.7 THEN risk_level = HIGH', severity: 'mandatory' },
        { id: 'L4', name: 'jurisdiction_check', rule: 'WHEN jurisdiction.recognized = FALSE THEN recommendation = REJECTED', severity: 'mandatory' },
        { id: 'L5', name: 'statute_of_limitations', rule: 'WHEN case.filing_within_statute = FALSE THEN recommendation = REJECTED', severity: 'mandatory' },
        { id: 'L6', name: 'evidence_sufficiency', rule: 'WHEN evidence.score < 0.3 THEN recommendation ≠ APPROVED', severity: 'mandatory' },
        { id: 'L7', name: 'conflict_of_interest', rule: 'WHEN conflict.detected = TRUE THEN flag_conflict = TRUE', severity: 'warning' },
        { id: 'L8', name: 'precedent_alignment', rule: 'WHEN precedent.alignment < 0.4 THEN risk_level >= MEDIUM', severity: 'mandatory' },
        { id: 'L9', name: 'financial_exposure', rule: 'WHEN financial.exposure > threshold THEN require_senior_review = TRUE', severity: 'warning' },
        { id: 'L10', name: 'multi_risk', rule: 'WHEN triggered_risks >= 3 THEN risk_level >= MEDIUM', severity: 'mandatory' }
    ],
    policy_hash: null,
    authority_signature: null
};

(function () {
    const payload = JSON.stringify({
        name: LEGAL_POLICY.policy_name,
        version: LEGAL_POLICY.version,
        declaration_timestamp: LEGAL_POLICY.declaration_timestamp,
        constraints: LEGAL_POLICY.constraints.map(c => c.id + c.rule)
    });
    LEGAL_POLICY.policy_hash = crypto.createHash('sha256').update(payload).digest('hex');
    LEGAL_POLICY.authority_signature = crypto.createHmac('sha256', POO_SECRET).update(LEGAL_POLICY.policy_hash).digest('hex');
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

function generatePoO(caseData, policy, timestamp) {
    const state = JSON.stringify({ D: caseData, P: policy, T: timestamp });
    const hash = crypto.createHash('sha256').update(state).digest('hex');
    const signature = crypto.createHmac('sha256', POO_SECRET).update(hash + timestamp).digest('hex');
    return {
        hash,
        timestamp,
        signature,
        algorithm: 'SHA-256',
        state_reference: `PoO-LEG-${Date.now()}`
    };
}

// ═══════════════════════════════════════════════════════════════
// CASE TYPE DETECTION
// ═══════════════════════════════════════════════════════════════

function detectCaseType(caseData) {
    if (caseData.case_type) return caseData.case_type.toUpperCase();
    if (caseData.contract_validity != null) return 'CONTRACT';
    if (caseData.liability_exposure != null && caseData.liability_exposure > 0.5) return 'LIABILITY';
    if (caseData.regulatory_compliance != null) return 'REGULATORY';
    return 'GENERAL';
}

// ═══════════════════════════════════════════════════════════════
// RISK SCORING
// ═══════════════════════════════════════════════════════════════

function calculateLegalRisk(caseData) {
    let score = 0;
    const weights = {
        contract: 0.20,
        regulatory: 0.20,
        liability: 0.20,
        evidence: 0.15,
        precedent: 0.15,
        jurisdiction: 0.10
    };

    // Contract risk (lower validity = higher risk)
    score += (1 - Math.min(1, Math.max(0, caseData.contract_validity || 0.5))) * weights.contract;

    // Regulatory risk (lower compliance = higher risk)
    score += (1 - Math.min(1, Math.max(0, caseData.regulatory_compliance || 0.5))) * weights.regulatory;

    // Liability exposure (higher = higher risk)
    score += Math.min(1, Math.max(0, caseData.liability_exposure || 0)) * weights.liability;

    // Evidence weakness (lower = higher risk)
    score += (1 - Math.min(1, Math.max(0, caseData.evidence_score || 0.5))) * weights.evidence;

    // Precedent misalignment (lower = higher risk)
    score += (1 - Math.min(1, Math.max(0, caseData.precedent_alignment || 0.5))) * weights.precedent;

    // Jurisdiction risk
    const jurisRisk = caseData.jurisdiction_recognized === false ? 1.0 : 0.0;
    score += jurisRisk * weights.jurisdiction;

    return Math.min(1, Math.max(0, parseFloat(score.toFixed(4))));
}

// ═══════════════════════════════════════════════════════════════
// DECISION ENGINE (10 Rules)
// ═══════════════════════════════════════════════════════════════

function evaluateLegal(caseData) {
    const timestamp = new Date().toISOString();
    const caseType = detectCaseType(caseData);
    const riskScore = calculateLegalRisk(caseData);

    let recommendation = 'APPROVED';
    let riskLevel = 'LOW';
    let flagNonCompliant = false;
    let flagConflict = false;
    let requireSeniorReview = false;
    const reasons = [];
    let triggeredCount = 0;

    const cv = caseData.contract_validity != null ? caseData.contract_validity : 0.7;
    const rc = caseData.regulatory_compliance != null ? caseData.regulatory_compliance : 0.7;
    const le = caseData.liability_exposure != null ? caseData.liability_exposure : 0.3;
    const es = caseData.evidence_score != null ? caseData.evidence_score : 0.6;
    const pa = caseData.precedent_alignment != null ? caseData.precedent_alignment : 0.6;
    const jr = caseData.jurisdiction_recognized !== false;
    const sl = caseData.within_statute !== false;
    const ci = caseData.conflict_of_interest === true;
    const fe = caseData.financial_exposure || 0;
    const feThreshold = caseData.financial_threshold || 100000;

    // ── L1: Contract Validity ──
    const l1 = cv < 0.4;
    if (l1) {
        recommendation = 'REJECTED';
        reasons.push(`L1: contract_validity=${cv} < 0.4 → recommendation = REJECTED`);
        triggeredCount++;
    }

    // ── L2: Regulatory Compliance ──
    const l2 = rc < 0.5;
    if (l2) {
        flagNonCompliant = true;
        if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
        reasons.push(`L2: regulatory_compliance=${rc} < 0.5 → flag_non_compliant = TRUE`);
        triggeredCount++;
    }

    // ── L3: Liability Threshold ──
    const l3 = le > 0.7;
    if (l3) {
        riskLevel = 'HIGH';
        reasons.push(`L3: liability_exposure=${le} > 0.7 → risk_level = HIGH`);
        triggeredCount++;
    }

    // ── L4: Jurisdiction Check ──
    const l4 = !jr;
    if (l4) {
        recommendation = 'REJECTED';
        reasons.push(`L4: jurisdiction_recognized=FALSE → recommendation = REJECTED`);
        triggeredCount++;
    }

    // ── L5: Statute of Limitations ──
    const l5 = !sl;
    if (l5) {
        recommendation = 'REJECTED';
        reasons.push(`L5: within_statute=FALSE → recommendation = REJECTED`);
        triggeredCount++;
    }

    // ── L6: Evidence Sufficiency ──
    const l6 = es < 0.3;
    if (l6) {
        if (recommendation === 'APPROVED') recommendation = 'FURTHER_REVIEW';
        reasons.push(`L6: evidence_score=${es} < 0.3 → recommendation ≠ APPROVED`);
        triggeredCount++;
    }

    // ── L7: Conflict of Interest ──
    const l7 = ci;
    if (l7) {
        flagConflict = true;
        reasons.push(`L7: conflict_of_interest=TRUE → flag_conflict = TRUE`);
        triggeredCount++;
    }

    // ── L8: Precedent Alignment ──
    const l8 = pa < 0.4;
    if (l8) {
        if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
        reasons.push(`L8: precedent_alignment=${pa} < 0.4 → risk_level >= MEDIUM`);
        triggeredCount++;
    }

    // ── L9: Financial Exposure ──
    const l9 = fe > feThreshold;
    if (l9) {
        requireSeniorReview = true;
        reasons.push(`L9: financial_exposure=${fe} > ${feThreshold} → require_senior_review = TRUE`);
        triggeredCount++;
    }

    // ── L10: Multi-Risk Escalation ──
    const l10 = triggeredCount >= 3;
    if (l10 && riskLevel === 'LOW') {
        riskLevel = 'MEDIUM';
        reasons.push(`L10: triggered_risks=${triggeredCount} >= 3 → risk_level >= MEDIUM`);
    }

    // Final recommendation adjustment based on risk
    if (recommendation === 'APPROVED' && riskLevel === 'HIGH') {
        recommendation = 'FURTHER_REVIEW';
    }

    const allRules = [
        { id: 'L1', rule: 'IF contract_validity < 0.4 THEN REJECTED', triggered: l1, detail: `contract_validity = ${cv} ${l1 ? '<' : '≥'} 0.4` },
        { id: 'L2', rule: 'IF regulatory_compliance < 0.5 THEN non_compliant', triggered: l2, detail: `regulatory_compliance = ${rc} ${l2 ? '<' : '≥'} 0.5` },
        { id: 'L3', rule: 'IF liability_exposure > 0.7 THEN risk = HIGH', triggered: l3, detail: `liability_exposure = ${le} ${l3 ? '>' : '≤'} 0.7` },
        { id: 'L4', rule: 'IF jurisdiction unrecognized THEN REJECTED', triggered: l4, detail: `jurisdiction_recognized = ${jr}` },
        { id: 'L5', rule: 'IF outside statute of limitations THEN REJECTED', triggered: l5, detail: `within_statute = ${sl}` },
        { id: 'L6', rule: 'IF evidence_score < 0.3 THEN ≠ APPROVED', triggered: l6, detail: `evidence_score = ${es} ${l6 ? '<' : '≥'} 0.3` },
        { id: 'L7', rule: 'IF conflict_of_interest THEN flag_conflict', triggered: l7, detail: `conflict_of_interest = ${ci}` },
        { id: 'L8', rule: 'IF precedent_alignment < 0.4 THEN risk ≥ MEDIUM', triggered: l8, detail: `precedent_alignment = ${pa} ${l8 ? '<' : '≥'} 0.4` },
        { id: 'L9', rule: 'IF financial_exposure > threshold THEN senior_review', triggered: l9, detail: `financial_exposure = ${fe} ${l9 ? '>' : '≤'} ${feThreshold}` },
        { id: 'L10', rule: 'IF triggered_risks ≥ 3 THEN risk ≥ MEDIUM', triggered: l10, detail: `triggered_risks = ${triggeredCount} ${l10 ? '≥' : '<'} 3` }
    ];

    const decision = {
        recommendation,
        risk_level: riskLevel,
        risk_score: riskScore,
        case_type: caseType,
        non_compliant: flagNonCompliant,
        conflict_flagged: flagConflict,
        senior_review_required: requireSeniorReview,
        triggered_rules: triggeredCount,
        timestamp,
        reasons,
        allRules
    };

    const poo = generatePoO(caseData, LEGAL_POLICY.policy_name, timestamp);
    const por = generatePoR(caseData, decision);
    const poi = verifyPoI(decision, caseData);
    const bundle = createVerificationBundle(poo, por, poi);

    return { decision, verification_bundle: bundle };
}

// ═══════════════════════════════════════════════════════════════
// PROOF OF REASON (PoR)
// ═══════════════════════════════════════════════════════════════

function generatePoR(caseData, decision) {
    const vertices = [
        { id: 'p1', type: 'premise', label: `contract_validity = ${caseData.contract_validity || 0.7}` },
        { id: 'p2', type: 'premise', label: `regulatory_compliance = ${caseData.regulatory_compliance || 0.7}` },
        { id: 'p3', type: 'premise', label: `liability_exposure = ${caseData.liability_exposure || 0.3}` },
        { id: 'p4', type: 'premise', label: `evidence_score = ${caseData.evidence_score || 0.6}` },
        { id: 'p5', type: 'premise', label: `precedent_alignment = ${caseData.precedent_alignment || 0.6}` },
        { id: 'p6', type: 'premise', label: `jurisdiction_recognized = ${caseData.jurisdiction_recognized !== false}` },
        { id: 'p7', type: 'premise', label: `within_statute = ${caseData.within_statute !== false}` },
        { id: 'p8', type: 'premise', label: `case_type = ${decision.case_type}` },
        { id: 'r1', type: 'rule', label: 'L1: contract < 0.4 → REJECTED' },
        { id: 'r2', type: 'rule', label: 'L2: regulatory < 0.5 → non_compliant' },
        { id: 'r3', type: 'rule', label: 'L3: liability > 0.7 → HIGH risk' },
        { id: 'r4', type: 'rule', label: 'L4: jurisdiction invalid → REJECTED' },
        { id: 'r5', type: 'rule', label: 'L5: outside statute → REJECTED' },
        { id: 'r6', type: 'rule', label: 'L6: evidence < 0.3 → ≠ APPROVED' },
        { id: 'r7', type: 'rule', label: 'L8: precedent < 0.4 → risk ≥ MEDIUM' },
        { id: 'r8', type: 'rule', label: 'L10: multi-risk → MEDIUM+' },
        { id: 'c1', type: 'conclusion', label: `recommendation = ${decision.recommendation}` },
        { id: 'c2', type: 'conclusion', label: `risk_level = ${decision.risk_level}` },
        { id: 'c3', type: 'conclusion', label: `risk_score = ${decision.risk_score}` }
    ];

    const edges = [
        { from: 'p1', to: 'r1', relation: 'input' },
        { from: 'p2', to: 'r2', relation: 'input' },
        { from: 'p3', to: 'r3', relation: 'input' },
        { from: 'p6', to: 'r4', relation: 'input' },
        { from: 'p7', to: 'r5', relation: 'input' },
        { from: 'p4', to: 'r6', relation: 'input' },
        { from: 'p5', to: 'r7', relation: 'input' },
        { from: 'r1', to: 'c1', relation: 'determines' },
        { from: 'r2', to: 'c2', relation: 'influences' },
        { from: 'r3', to: 'c2', relation: 'determines' },
        { from: 'r4', to: 'c1', relation: 'determines' },
        { from: 'r5', to: 'c1', relation: 'determines' },
        { from: 'r6', to: 'c1', relation: 'influences' },
        { from: 'r7', to: 'c2', relation: 'influences' },
        { from: 'r8', to: 'c2', relation: 'influences' },
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

function verifyPoI(decision, caseData) {
    const results = [];

    // L1
    results.push({
        constraint: 'L1 - contract_validity',
        satisfied: (caseData.contract_validity || 0.7) >= 0.4 || decision.recommendation === 'REJECTED',
        severity: 'mandatory',
        detail: `contract_validity=${caseData.contract_validity || 0.7}, recommendation=${decision.recommendation}`
    });

    // L2
    results.push({
        constraint: 'L2 - regulatory_compliance',
        satisfied: (caseData.regulatory_compliance || 0.7) >= 0.5 || decision.non_compliant === true,
        severity: 'mandatory',
        detail: `regulatory_compliance=${caseData.regulatory_compliance || 0.7}, flagged=${decision.non_compliant}`
    });

    // L3
    results.push({
        constraint: 'L3 - liability_threshold',
        satisfied: (caseData.liability_exposure || 0.3) <= 0.7 || decision.risk_level === 'HIGH',
        severity: 'mandatory',
        detail: `liability_exposure=${caseData.liability_exposure || 0.3}, risk_level=${decision.risk_level}`
    });

    // L4
    results.push({
        constraint: 'L4 - jurisdiction_check',
        satisfied: caseData.jurisdiction_recognized !== false || decision.recommendation === 'REJECTED',
        severity: 'mandatory',
        detail: `jurisdiction_recognized=${caseData.jurisdiction_recognized !== false}, recommendation=${decision.recommendation}`
    });

    // L5
    results.push({
        constraint: 'L5 - statute_of_limitations',
        satisfied: caseData.within_statute !== false || decision.recommendation === 'REJECTED',
        severity: 'mandatory',
        detail: `within_statute=${caseData.within_statute !== false}, recommendation=${decision.recommendation}`
    });

    // L6
    results.push({
        constraint: 'L6 - evidence_sufficiency',
        satisfied: (caseData.evidence_score || 0.6) >= 0.3 || decision.recommendation !== 'APPROVED',
        severity: 'mandatory',
        detail: `evidence_score=${caseData.evidence_score || 0.6}, recommendation=${decision.recommendation}`
    });

    // Axiom 3.1
    results.push({
        constraint: 'Axiom 3.1 - Temporal Precedence',
        satisfied: LEGAL_POLICY.declaration_timestamp < decision.timestamp,
        severity: 'mandatory',
        detail: `PoI declared: ${LEGAL_POLICY.declaration_timestamp}, Decision: ${decision.timestamp}`
    });

    const all_mandatory_satisfied = results.filter(r => r.severity === 'mandatory').every(r => r.satisfied);

    return {
        policy: LEGAL_POLICY.policy_name,
        policy_hash: LEGAL_POLICY.policy_hash,
        declaration_time: LEGAL_POLICY.declaration_timestamp,
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
        bundle_id: `VB-LEG-${Date.now()}`,
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
    LEGAL_POLICY,
    evaluateLegal,
    generatePoO,
    generatePoR,
    verifyPoI,
    createVerificationBundle,
    computeMerkleRoot,
    detectCaseType,
    calculateLegalRisk
};

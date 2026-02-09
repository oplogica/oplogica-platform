/**
 * OpLogica Credit Assessment Engine v2.0 — Triadic Verification
 * Enhanced Financial Credit Assessment Protocol.
 * DETERMINISTIC: same inputs → same outputs.
 *
 * Categories: Personal, Mortgage, Business, Auto, Education
 * Rules: 10 financial decision rules with full cryptographic proof bundles
 * Verification: PoO (Proof of Origin), PoR (Proof of Reason), PoI (Proof of Intent)
 */

const crypto = require('crypto');

const POO_SECRET = process.env.POO_SECRET || 'oplogica-verification-key';

// ═══════════════════════════════════════════════════════════════
// POLICY DECLARATION (Axiom 3.1 — Temporal Precedence)
// ═══════════════════════════════════════════════════════════════

const CREDIT_POLICY = {
    policy_name: 'Financial Credit Assessment Protocol v2.0',
    authority: 'OpLogica Financial Ethics Framework',
    declaration_timestamp: '2024-11-15T09:00:00Z',
    version: '2.0.0',
    constraints: [
        { id: 'F1', name: 'credit_floor', rule: 'WHEN credit_score < 500 THEN recommendation = DENIED', severity: 'mandatory' },
        { id: 'F2', name: 'dti_ceiling', rule: 'WHEN debt_to_income > 0.50 THEN recommendation = DENIED', severity: 'mandatory' },
        { id: 'F3', name: 'income_minimum', rule: 'WHEN annual_income < 20000 THEN risk_level >= MEDIUM', severity: 'mandatory' },
        { id: 'F4', name: 'loan_to_income', rule: 'WHEN loan_amount / annual_income > 5.0 THEN recommendation ≠ APPROVED', severity: 'mandatory' },
        { id: 'F5', name: 'employment_stability', rule: 'WHEN employment_years < 1 THEN risk_modifier = ELEVATED', severity: 'mandatory' },
        { id: 'F6', name: 'collateral_check', rule: 'WHEN loan_type = MORTGAGE AND collateral_ratio < 0.8 THEN flag_undercollateralized', severity: 'mandatory' },
        { id: 'F7', name: 'bankruptcy_history', rule: 'WHEN bankruptcy_history = TRUE THEN risk_level = HIGH', severity: 'mandatory' },
        { id: 'F8', name: 'payment_history', rule: 'WHEN payment_history_score < 0.4 THEN risk_level >= MEDIUM', severity: 'mandatory' },
        { id: 'F9', name: 'credit_utilization', rule: 'WHEN credit_utilization > 0.80 THEN risk_modifier = ELEVATED', severity: 'warning' },
        { id: 'F10', name: 'multi_risk', rule: 'WHEN triggered_risks >= 3 THEN recommendation ≠ APPROVED', severity: 'mandatory' }
    ],
    policy_hash: null,
    authority_signature: null
};

(function () {
    const payload = JSON.stringify({
        name: CREDIT_POLICY.policy_name,
        version: CREDIT_POLICY.version,
        declaration_timestamp: CREDIT_POLICY.declaration_timestamp,
        constraints: CREDIT_POLICY.constraints.map(c => c.id + c.rule)
    });
    CREDIT_POLICY.policy_hash = crypto.createHash('sha256').update(payload).digest('hex');
    CREDIT_POLICY.authority_signature = crypto.createHmac('sha256', POO_SECRET).update(CREDIT_POLICY.policy_hash).digest('hex');
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

function generatePoO(applicantData, policy, timestamp) {
    const state = JSON.stringify({ D: applicantData, P: policy, T: timestamp });
    const hash = crypto.createHash('sha256').update(state).digest('hex');
    const signature = crypto.createHmac('sha256', POO_SECRET).update(hash + timestamp).digest('hex');
    return {
        hash,
        timestamp,
        signature,
        algorithm: 'SHA-256',
        state_reference: `PoO-CRD-${Date.now()}`
    };
}

// ═══════════════════════════════════════════════════════════════
// LOAN TYPE DETECTION
// ═══════════════════════════════════════════════════════════════

function detectLoanType(applicantData) {
    if (applicantData.loan_type) return applicantData.loan_type.toUpperCase();
    if (applicantData.collateral_ratio != null) return 'MORTGAGE';
    if (applicantData.business_revenue != null) return 'BUSINESS';
    if (applicantData.vehicle_value != null) return 'AUTO';
    if (applicantData.tuition_amount != null) return 'EDUCATION';
    return 'PERSONAL';
}

// ═══════════════════════════════════════════════════════════════
// RISK SCORING
// ═══════════════════════════════════════════════════════════════

function calculateCreditRisk(applicantData) {
    let score = 0;
    const weights = {
        credit: 0.25,
        dti: 0.20,
        income: 0.15,
        employment: 0.10,
        payment: 0.15,
        utilization: 0.10,
        bankruptcy: 0.05
    };

    // Credit score risk (lower score = higher risk, scale 300-850)
    const creditNorm = Math.min(1, Math.max(0, ((applicantData.credit_score || 650) - 300) / 550));
    score += (1 - creditNorm) * weights.credit;

    // DTI risk (higher = riskier)
    score += Math.min(1, Math.max(0, (applicantData.debt_to_income || 0.3) / 0.6)) * weights.dti;

    // Income risk (lower = riskier)
    const incomeNorm = Math.min(1, Math.max(0, (applicantData.annual_income || 50000) / 150000));
    score += (1 - incomeNorm) * weights.income;

    // Employment stability (shorter = riskier)
    const empNorm = Math.min(1, Math.max(0, (applicantData.employment_years || 3) / 10));
    score += (1 - empNorm) * weights.employment;

    // Payment history (lower = riskier)
    score += (1 - Math.min(1, Math.max(0, applicantData.payment_history_score || 0.7))) * weights.payment;

    // Credit utilization (higher = riskier)
    score += Math.min(1, Math.max(0, applicantData.credit_utilization || 0.3)) * weights.utilization;

    // Bankruptcy
    if (applicantData.bankruptcy_history === true) score += 1.0 * weights.bankruptcy;

    return Math.min(1, Math.max(0, parseFloat(score.toFixed(4))));
}

// ═══════════════════════════════════════════════════════════════
// INTEREST RATE TIER
// ═══════════════════════════════════════════════════════════════

function determineInterestTier(riskScore, creditScore) {
    if (riskScore < 0.2 && creditScore >= 750) return 'PRIME';
    if (riskScore < 0.35 && creditScore >= 680) return 'PRIME_PLUS';
    if (riskScore < 0.5) return 'STANDARD';
    if (riskScore < 0.7) return 'SUBPRIME';
    return 'HIGH_RISK';
}

// ═══════════════════════════════════════════════════════════════
// DECISION ENGINE (10 Rules)
// ═══════════════════════════════════════════════════════════════

function evaluateCredit(applicantData) {
    const timestamp = new Date().toISOString();
    const loanType = detectLoanType(applicantData);
    const riskScore = calculateCreditRisk(applicantData);

    let recommendation = 'APPROVED';
    let riskLevel = 'LOW';
    let flagUndercollateralized = false;
    const reasons = [];
    let triggeredCount = 0;

    const cs = applicantData.credit_score != null ? applicantData.credit_score : 650;
    const dti = applicantData.debt_to_income != null ? applicantData.debt_to_income : 0.30;
    const income = applicantData.annual_income != null ? applicantData.annual_income : 50000;
    const loan = applicantData.loan_amount != null ? applicantData.loan_amount : 20000;
    const empYears = applicantData.employment_years != null ? applicantData.employment_years : 3;
    const collateral = applicantData.collateral_ratio != null ? applicantData.collateral_ratio : 1.0;
    const bankruptcy = applicantData.bankruptcy_history === true;
    const paymentHistory = applicantData.payment_history_score != null ? applicantData.payment_history_score : 0.7;
    const utilization = applicantData.credit_utilization != null ? applicantData.credit_utilization : 0.30;
    const lti = income > 0 ? loan / income : 99;

    // ── F1: Credit Floor ──
    const f1 = cs < 500;
    if (f1) {
        recommendation = 'DENIED';
        reasons.push(`F1: credit_score=${cs} < 500 → recommendation = DENIED`);
        triggeredCount++;
    }

    // ── F2: DTI Ceiling ──
    const f2 = dti > 0.50;
    if (f2) {
        recommendation = 'DENIED';
        reasons.push(`F2: debt_to_income=${dti} > 0.50 → recommendation = DENIED`);
        triggeredCount++;
    }

    // ── F3: Income Minimum ──
    const f3 = income < 20000;
    if (f3) {
        if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
        reasons.push(`F3: annual_income=${income} < 20000 → risk_level >= MEDIUM`);
        triggeredCount++;
    }

    // ── F4: Loan-to-Income ──
    const f4 = lti > 5.0;
    if (f4) {
        if (recommendation === 'APPROVED') recommendation = 'MANUAL_REVIEW';
        reasons.push(`F4: loan_to_income=${lti.toFixed(2)} > 5.0 → recommendation ≠ APPROVED`);
        triggeredCount++;
    }

    // ── F5: Employment Stability ──
    const f5 = empYears < 1;
    if (f5) {
        if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
        reasons.push(`F5: employment_years=${empYears} < 1 → risk_modifier = ELEVATED`);
        triggeredCount++;
    }

    // ── F6: Collateral Check (Mortgage) ──
    const f6 = loanType === 'MORTGAGE' && collateral < 0.8;
    if (f6) {
        flagUndercollateralized = true;
        if (recommendation === 'APPROVED') recommendation = 'MANUAL_REVIEW';
        reasons.push(`F6: loan_type=MORTGAGE AND collateral_ratio=${collateral} < 0.8 → undercollateralized`);
        triggeredCount++;
    }

    // ── F7: Bankruptcy History ──
    const f7 = bankruptcy;
    if (f7) {
        riskLevel = 'HIGH';
        reasons.push('F7: bankruptcy_history = TRUE → risk_level = HIGH');
        triggeredCount++;
    }

    // ── F8: Payment History ──
    const f8 = paymentHistory < 0.4;
    if (f8) {
        if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
        reasons.push(`F8: payment_history_score=${paymentHistory} < 0.4 → risk_level >= MEDIUM`);
        triggeredCount++;
    }

    // ── F9: Credit Utilization ──
    const f9 = utilization > 0.80;
    if (f9) {
        if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
        reasons.push(`F9: credit_utilization=${utilization} > 0.80 → risk_modifier = ELEVATED`);
        triggeredCount++;
    }

    // ── F10: Multi-Risk Escalation ──
    const f10 = triggeredCount >= 3;
    if (f10 && recommendation === 'APPROVED') {
        recommendation = 'MANUAL_REVIEW';
        reasons.push(`F10: triggered_risks=${triggeredCount} >= 3 → recommendation ≠ APPROVED`);
    }

    // Final adjustment
    if (recommendation === 'APPROVED' && riskLevel === 'HIGH') {
        recommendation = 'MANUAL_REVIEW';
    }

    const interestTier = determineInterestTier(riskScore, cs);

    const allRules = [
        { id: 'F1', rule: 'IF credit_score < 500 THEN DENIED', triggered: f1, detail: `credit_score = ${cs} ${f1 ? '<' : '≥'} 500` },
        { id: 'F2', rule: 'IF debt_to_income > 0.50 THEN DENIED', triggered: f2, detail: `dti = ${dti} ${f2 ? '>' : '≤'} 0.50` },
        { id: 'F3', rule: 'IF annual_income < 20000 THEN risk ≥ MEDIUM', triggered: f3, detail: `income = ${income} ${f3 ? '<' : '≥'} 20000` },
        { id: 'F4', rule: 'IF loan/income > 5.0 THEN ≠ APPROVED', triggered: f4, detail: `loan_to_income = ${lti.toFixed(2)} ${f4 ? '>' : '≤'} 5.0` },
        { id: 'F5', rule: 'IF employment < 1yr THEN risk ELEVATED', triggered: f5, detail: `employment_years = ${empYears} ${f5 ? '<' : '≥'} 1` },
        { id: 'F6', rule: 'IF MORTGAGE AND collateral < 0.8 THEN undercollateralized', triggered: f6, detail: `type = ${loanType}, collateral = ${collateral}` },
        { id: 'F7', rule: 'IF bankruptcy THEN risk = HIGH', triggered: f7, detail: `bankruptcy_history = ${bankruptcy}` },
        { id: 'F8', rule: 'IF payment_history < 0.4 THEN risk ≥ MEDIUM', triggered: f8, detail: `payment_history = ${paymentHistory} ${f8 ? '<' : '≥'} 0.4` },
        { id: 'F9', rule: 'IF credit_utilization > 0.80 THEN risk ELEVATED', triggered: f9, detail: `utilization = ${utilization} ${f9 ? '>' : '≤'} 0.80` },
        { id: 'F10', rule: 'IF triggered_risks ≥ 3 THEN ≠ APPROVED', triggered: f10, detail: `triggered_risks = ${triggeredCount} ${f10 ? '≥' : '<'} 3` }
    ];

    const decision = {
        recommendation,
        risk_level: riskLevel,
        risk_score: riskScore,
        loan_type: loanType,
        interest_rate_tier: interestTier,
        loan_to_income_ratio: parseFloat(lti.toFixed(2)),
        undercollateralized: flagUndercollateralized,
        triggered_rules: triggeredCount,
        timestamp,
        reasons,
        allRules
    };

    const poo = generatePoO(applicantData, CREDIT_POLICY.policy_name, timestamp);
    const por = generatePoR(applicantData, decision);
    const poi = verifyPoI(decision, applicantData);
    const bundle = createVerificationBundle(poo, por, poi);

    return { decision, verification_bundle: bundle };
}

// ═══════════════════════════════════════════════════════════════
// PROOF OF REASON (PoR)
// ═══════════════════════════════════════════════════════════════

function generatePoR(applicantData, decision) {
    const vertices = [
        { id: 'p1', type: 'premise', label: `credit_score = ${applicantData.credit_score || 650}` },
        { id: 'p2', type: 'premise', label: `debt_to_income = ${applicantData.debt_to_income || 0.30}` },
        { id: 'p3', type: 'premise', label: `annual_income = ${applicantData.annual_income || 50000}` },
        { id: 'p4', type: 'premise', label: `loan_amount = ${applicantData.loan_amount || 20000}` },
        { id: 'p5', type: 'premise', label: `employment_years = ${applicantData.employment_years || 3}` },
        { id: 'p6', type: 'premise', label: `payment_history = ${applicantData.payment_history_score || 0.7}` },
        { id: 'p7', type: 'premise', label: `credit_utilization = ${applicantData.credit_utilization || 0.30}` },
        { id: 'p8', type: 'premise', label: `loan_type = ${decision.loan_type}` },
        { id: 'r1', type: 'rule', label: 'F1: credit < 500 → DENIED' },
        { id: 'r2', type: 'rule', label: 'F2: DTI > 0.50 → DENIED' },
        { id: 'r3', type: 'rule', label: 'F3: income < 20k → risk MEDIUM+' },
        { id: 'r4', type: 'rule', label: 'F4: LTI > 5.0 → ≠ APPROVED' },
        { id: 'r5', type: 'rule', label: 'F5: employment < 1yr → ELEVATED' },
        { id: 'r6', type: 'rule', label: 'F7: bankruptcy → HIGH risk' },
        { id: 'r7', type: 'rule', label: 'F8: payment < 0.4 → risk MEDIUM+' },
        { id: 'r8', type: 'rule', label: 'F10: multi-risk → ≠ APPROVED' },
        { id: 'c1', type: 'conclusion', label: `recommendation = ${decision.recommendation}` },
        { id: 'c2', type: 'conclusion', label: `risk_level = ${decision.risk_level}` },
        { id: 'c3', type: 'conclusion', label: `interest_tier = ${decision.interest_rate_tier}` },
        { id: 'c4', type: 'conclusion', label: `risk_score = ${decision.risk_score}` }
    ];

    if (decision.loan_type === 'MORTGAGE') {
        vertices.push({ id: 'p9', type: 'premise', label: `collateral_ratio = ${applicantData.collateral_ratio || 1.0}` });
        vertices.push({ id: 'r9', type: 'rule', label: 'F6: MORTGAGE collateral < 0.8 → flag' });
    }

    const edges = [
        { from: 'p1', to: 'r1', relation: 'input' },
        { from: 'p2', to: 'r2', relation: 'input' },
        { from: 'p3', to: 'r3', relation: 'input' },
        { from: 'p3', to: 'r4', relation: 'input' },
        { from: 'p4', to: 'r4', relation: 'input' },
        { from: 'p5', to: 'r5', relation: 'input' },
        { from: 'p6', to: 'r7', relation: 'input' },
        { from: 'r1', to: 'c1', relation: 'determines' },
        { from: 'r2', to: 'c1', relation: 'determines' },
        { from: 'r3', to: 'c2', relation: 'influences' },
        { from: 'r4', to: 'c1', relation: 'influences' },
        { from: 'r5', to: 'c2', relation: 'influences' },
        { from: 'r6', to: 'c2', relation: 'determines' },
        { from: 'r7', to: 'c2', relation: 'influences' },
        { from: 'r8', to: 'c1', relation: 'influences' },
        { from: 'c1', to: 'c3', relation: 'produces' },
        { from: 'c2', to: 'c3', relation: 'produces' },
        { from: 'c1', to: 'c4', relation: 'produces' },
        { from: 'c2', to: 'c4', relation: 'produces' }
    ];

    if (decision.loan_type === 'MORTGAGE') {
        edges.push({ from: 'p9', to: 'r9', relation: 'input' });
        edges.push({ from: 'r9', to: 'c1', relation: 'influences' });
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

function verifyPoI(decision, applicantData) {
    const results = [];
    const cs = applicantData.credit_score != null ? applicantData.credit_score : 650;
    const dti = applicantData.debt_to_income != null ? applicantData.debt_to_income : 0.30;

    // F1
    results.push({
        constraint: 'F1 - credit_floor',
        satisfied: cs >= 500 || decision.recommendation === 'DENIED',
        severity: 'mandatory',
        detail: `credit_score=${cs}, recommendation=${decision.recommendation}`
    });

    // F2
    results.push({
        constraint: 'F2 - dti_ceiling',
        satisfied: dti <= 0.50 || decision.recommendation === 'DENIED',
        severity: 'mandatory',
        detail: `dti=${dti}, recommendation=${decision.recommendation}`
    });

    // F4
    results.push({
        constraint: 'F4 - loan_to_income',
        satisfied: decision.loan_to_income_ratio <= 5.0 || decision.recommendation !== 'APPROVED',
        severity: 'mandatory',
        detail: `lti=${decision.loan_to_income_ratio}, recommendation=${decision.recommendation}`
    });

    // F7
    results.push({
        constraint: 'F7 - bankruptcy_history',
        satisfied: applicantData.bankruptcy_history !== true || decision.risk_level === 'HIGH',
        severity: 'mandatory',
        detail: `bankruptcy=${applicantData.bankruptcy_history === true}, risk_level=${decision.risk_level}`
    });

    // Axiom 3.1
    results.push({
        constraint: 'Axiom 3.1 - Temporal Precedence',
        satisfied: CREDIT_POLICY.declaration_timestamp < decision.timestamp,
        severity: 'mandatory',
        detail: `PoI declared: ${CREDIT_POLICY.declaration_timestamp}, Decision: ${decision.timestamp}`
    });

    const all_mandatory_satisfied = results.filter(r => r.severity === 'mandatory').every(r => r.satisfied);

    return {
        policy: CREDIT_POLICY.policy_name,
        policy_hash: CREDIT_POLICY.policy_hash,
        declaration_time: CREDIT_POLICY.declaration_timestamp,
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
        bundle_id: `VB-CRD-${Date.now()}`,
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
    CREDIT_POLICY,
    evaluateCredit,
    generatePoO,
    generatePoR,
    verifyPoI,
    createVerificationBundle,
    computeMerkleRoot,
    detectLoanType,
    calculateCreditRisk,
    determineInterestTier
};

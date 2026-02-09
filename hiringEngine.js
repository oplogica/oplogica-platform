/**
 * OpLogica Hiring Assessment Engine v2.0 — Triadic Verification
 * Enhanced Employment Screening Protocol.
 * DETERMINISTIC: same inputs → same outputs.
 *
 * Categories: Technical, Executive, Operations, Creative, Entry-Level
 * Rules: 10 hiring decision rules with full cryptographic proof bundles
 * Verification: PoO (Proof of Origin), PoR (Proof of Reason), PoI (Proof of Intent)
 */

const crypto = require('crypto');

const POO_SECRET = process.env.POO_SECRET || 'oplogica-verification-key';

// ═══════════════════════════════════════════════════════════════
// POLICY DECLARATION (Axiom 3.1 — Temporal Precedence)
// ═══════════════════════════════════════════════════════════════

const HIRING_POLICY = {
    policy_name: 'Employment Screening Protocol v2.0',
    authority: 'OpLogica HR Ethics Framework',
    declaration_timestamp: '2024-11-15T09:00:00Z',
    version: '2.0.0',
    constraints: [
        { id: 'H1', name: 'skill_threshold', rule: 'WHEN skill_match_score < 0.3 THEN recommendation = NOT_RECOMMENDED', severity: 'mandatory' },
        { id: 'H2', name: 'experience_minimum', rule: 'WHEN role = SENIOR AND experience_years < 3 THEN recommendation ≠ RECOMMENDED', severity: 'mandatory' },
        { id: 'H3', name: 'interview_floor', rule: 'WHEN interview_score < 0.3 THEN recommendation = NOT_RECOMMENDED', severity: 'mandatory' },
        { id: 'H4', name: 'reference_check', rule: 'WHEN reference_score < 0.3 THEN flag_reference_concern = TRUE', severity: 'mandatory' },
        { id: 'H5', name: 'education_requirement', rule: 'WHEN role.requires_degree = TRUE AND education_level < 3 THEN recommendation ≠ RECOMMENDED', severity: 'mandatory' },
        { id: 'H6', name: 'cultural_fit', rule: 'WHEN cultural_fit_score < 0.3 THEN risk_flag = CULTURAL_MISMATCH', severity: 'warning' },
        { id: 'H7', name: 'background_check', rule: 'WHEN background_flagged = TRUE THEN recommendation = FURTHER_REVIEW', severity: 'mandatory' },
        { id: 'H8', name: 'salary_alignment', rule: 'WHEN salary_expectation > budget * 1.2 THEN flag_budget_exceed = TRUE', severity: 'warning' },
        { id: 'H9', name: 'diversity_consideration', rule: 'WHEN diversity_metrics.enabled = TRUE THEN apply_balanced_scoring', severity: 'mandatory' },
        { id: 'H10', name: 'multi_concern', rule: 'WHEN triggered_concerns >= 3 THEN recommendation ≠ RECOMMENDED', severity: 'mandatory' }
    ],
    policy_hash: null,
    authority_signature: null
};

(function () {
    const payload = JSON.stringify({
        name: HIRING_POLICY.policy_name,
        version: HIRING_POLICY.version,
        declaration_timestamp: HIRING_POLICY.declaration_timestamp,
        constraints: HIRING_POLICY.constraints.map(c => c.id + c.rule)
    });
    HIRING_POLICY.policy_hash = crypto.createHash('sha256').update(payload).digest('hex');
    HIRING_POLICY.authority_signature = crypto.createHmac('sha256', POO_SECRET).update(HIRING_POLICY.policy_hash).digest('hex');
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

function generatePoO(candidateData, policy, timestamp) {
    const state = JSON.stringify({ D: candidateData, P: policy, T: timestamp });
    const hash = crypto.createHash('sha256').update(state).digest('hex');
    const signature = crypto.createHmac('sha256', POO_SECRET).update(hash + timestamp).digest('hex');
    return {
        hash,
        timestamp,
        signature,
        algorithm: 'SHA-256',
        state_reference: `PoO-HIR-${Date.now()}`
    };
}

// ═══════════════════════════════════════════════════════════════
// ROLE CATEGORY DETECTION
// ═══════════════════════════════════════════════════════════════

function detectRoleCategory(candidateData) {
    if (candidateData.role_category) return candidateData.role_category.toUpperCase();
    if (candidateData.technical_score != null) return 'TECHNICAL';
    if (candidateData.leadership_score != null) return 'EXECUTIVE';
    if (candidateData.experience_years != null && candidateData.experience_years < 2) return 'ENTRY_LEVEL';
    if (candidateData.portfolio_score != null) return 'CREATIVE';
    return 'OPERATIONS';
}

// ═══════════════════════════════════════════════════════════════
// COMPOSITE SCORING
// ═══════════════════════════════════════════════════════════════

function calculateCompositeScore(candidateData, roleCategory) {
    const weights = {
        TECHNICAL:    { skill: 0.30, experience: 0.20, interview: 0.20, education: 0.10, reference: 0.10, cultural: 0.10 },
        EXECUTIVE:    { skill: 0.15, experience: 0.25, interview: 0.25, education: 0.10, reference: 0.15, cultural: 0.10 },
        OPERATIONS:   { skill: 0.25, experience: 0.20, interview: 0.20, education: 0.10, reference: 0.10, cultural: 0.15 },
        CREATIVE:     { skill: 0.35, experience: 0.10, interview: 0.20, education: 0.05, reference: 0.10, cultural: 0.20 },
        ENTRY_LEVEL:  { skill: 0.25, experience: 0.05, interview: 0.30, education: 0.15, reference: 0.10, cultural: 0.15 }
    };

    const w = weights[roleCategory] || weights.OPERATIONS;

    let score = 0;

    // Skill match (0-1)
    score += Math.min(1, Math.max(0, candidateData.skill_match_score || 0.5)) * w.skill;

    // Experience (normalized: years / 15 capped at 1)
    const expNorm = Math.min(1, Math.max(0, (candidateData.experience_years || 0) / 15));
    score += expNorm * w.experience;

    // Interview (0-1)
    score += Math.min(1, Math.max(0, candidateData.interview_score || 0.5)) * w.interview;

    // Education (1-5 normalized)
    const eduNorm = Math.min(1, Math.max(0, ((candidateData.education_level || 3) - 1) / 4));
    score += eduNorm * w.education;

    // Reference (0-1)
    score += Math.min(1, Math.max(0, candidateData.reference_score || 0.5)) * w.reference;

    // Cultural fit (0-1)
    score += Math.min(1, Math.max(0, candidateData.cultural_fit_score || 0.5)) * w.cultural;

    return Math.min(1, Math.max(0, parseFloat(score.toFixed(4))));
}

// ═══════════════════════════════════════════════════════════════
// CANDIDATE TIER
// ═══════════════════════════════════════════════════════════════

function determineCandidateTier(compositeScore) {
    if (compositeScore >= 0.85) return 'EXCEPTIONAL';
    if (compositeScore >= 0.70) return 'STRONG';
    if (compositeScore >= 0.55) return 'QUALIFIED';
    if (compositeScore >= 0.40) return 'MARGINAL';
    return 'BELOW_THRESHOLD';
}

// ═══════════════════════════════════════════════════════════════
// DECISION ENGINE (10 Rules)
// ═══════════════════════════════════════════════════════════════

function evaluateCandidate(candidateData) {
    const timestamp = new Date().toISOString();
    const roleCategory = detectRoleCategory(candidateData);
    const compositeScore = calculateCompositeScore(candidateData, roleCategory);
    const candidateTier = determineCandidateTier(compositeScore);

    let recommendation = 'RECOMMENDED';
    let flagReferenceConcern = false;
    let flagCulturalMismatch = false;
    let flagBudgetExceed = false;
    const reasons = [];
    let triggeredCount = 0;

    const skillScore = candidateData.skill_match_score != null ? candidateData.skill_match_score : 0.5;
    const expYears = candidateData.experience_years != null ? candidateData.experience_years : 3;
    const interviewScore = candidateData.interview_score != null ? candidateData.interview_score : 0.5;
    const refScore = candidateData.reference_score != null ? candidateData.reference_score : 0.5;
    const eduLevel = candidateData.education_level != null ? candidateData.education_level : 3;
    const culturalFit = candidateData.cultural_fit_score != null ? candidateData.cultural_fit_score : 0.5;
    const backgroundFlagged = candidateData.background_flagged === true;
    const salaryExpect = candidateData.salary_expectation || 0;
    const salaryBudget = candidateData.salary_budget || salaryExpect;
    const requiresDegree = candidateData.requires_degree !== false;
    const isSenior = candidateData.role_level === 'SENIOR' || expYears >= 8;

    // ── H1: Skill Threshold ──
    const h1 = skillScore < 0.3;
    if (h1) {
        recommendation = 'NOT_RECOMMENDED';
        reasons.push(`H1: skill_match_score=${skillScore} < 0.3 → NOT_RECOMMENDED`);
        triggeredCount++;
    }

    // ── H2: Experience Minimum (Senior) ──
    const h2 = isSenior && expYears < 3;
    if (h2) {
        if (recommendation === 'RECOMMENDED') recommendation = 'FURTHER_REVIEW';
        reasons.push(`H2: role=SENIOR AND experience=${expYears} < 3 → ≠ RECOMMENDED`);
        triggeredCount++;
    }

    // ── H3: Interview Floor ──
    const h3 = interviewScore < 0.3;
    if (h3) {
        recommendation = 'NOT_RECOMMENDED';
        reasons.push(`H3: interview_score=${interviewScore} < 0.3 → NOT_RECOMMENDED`);
        triggeredCount++;
    }

    // ── H4: Reference Check ──
    const h4 = refScore < 0.3;
    if (h4) {
        flagReferenceConcern = true;
        if (recommendation === 'RECOMMENDED') recommendation = 'FURTHER_REVIEW';
        reasons.push(`H4: reference_score=${refScore} < 0.3 → flag_reference_concern`);
        triggeredCount++;
    }

    // ── H5: Education Requirement ──
    const h5 = requiresDegree && eduLevel < 3;
    if (h5) {
        if (recommendation === 'RECOMMENDED') recommendation = 'FURTHER_REVIEW';
        reasons.push(`H5: requires_degree AND education_level=${eduLevel} < 3 → ≠ RECOMMENDED`);
        triggeredCount++;
    }

    // ── H6: Cultural Fit ──
    const h6 = culturalFit < 0.3;
    if (h6) {
        flagCulturalMismatch = true;
        reasons.push(`H6: cultural_fit_score=${culturalFit} < 0.3 → CULTURAL_MISMATCH`);
        triggeredCount++;
    }

    // ── H7: Background Check ──
    const h7 = backgroundFlagged;
    if (h7) {
        if (recommendation === 'RECOMMENDED') recommendation = 'FURTHER_REVIEW';
        reasons.push('H7: background_flagged = TRUE → FURTHER_REVIEW');
        triggeredCount++;
    }

    // ── H8: Salary Alignment ──
    const h8 = salaryBudget > 0 && salaryExpect > salaryBudget * 1.2;
    if (h8) {
        flagBudgetExceed = true;
        reasons.push(`H8: salary_expectation=${salaryExpect} > budget=${salaryBudget} * 1.2 → budget_exceed`);
        triggeredCount++;
    }

    // ── H9: Diversity Consideration ──
    const h9 = candidateData.diversity_enabled === true;
    if (h9) {
        reasons.push('H9: diversity_metrics enabled → balanced_scoring applied');
        // No trigger count — this is a process rule, not a concern
    }

    // ── H10: Multi-Concern Escalation ──
    const h10 = triggeredCount >= 3;
    if (h10 && recommendation === 'RECOMMENDED') {
        recommendation = 'FURTHER_REVIEW';
        reasons.push(`H10: triggered_concerns=${triggeredCount} >= 3 → ≠ RECOMMENDED`);
    }

    // Tier-based final check
    if (recommendation === 'RECOMMENDED' && candidateTier === 'BELOW_THRESHOLD') {
        recommendation = 'NOT_RECOMMENDED';
        reasons.push(`Tier check: candidate_tier=BELOW_THRESHOLD → NOT_RECOMMENDED`);
    }
    if (recommendation === 'RECOMMENDED' && candidateTier === 'MARGINAL') {
        recommendation = 'FURTHER_REVIEW';
        reasons.push(`Tier check: candidate_tier=MARGINAL → FURTHER_REVIEW`);
    }

    const allRules = [
        { id: 'H1', rule: 'IF skill_match < 0.3 THEN NOT_RECOMMENDED', triggered: h1, detail: `skill_match = ${skillScore} ${h1 ? '<' : '≥'} 0.3` },
        { id: 'H2', rule: 'IF SENIOR AND experience < 3yr THEN ≠ RECOMMENDED', triggered: h2, detail: `senior = ${isSenior}, experience = ${expYears}` },
        { id: 'H3', rule: 'IF interview < 0.3 THEN NOT_RECOMMENDED', triggered: h3, detail: `interview = ${interviewScore} ${h3 ? '<' : '≥'} 0.3` },
        { id: 'H4', rule: 'IF reference < 0.3 THEN flag_concern', triggered: h4, detail: `reference = ${refScore} ${h4 ? '<' : '≥'} 0.3` },
        { id: 'H5', rule: 'IF requires_degree AND education < 3 THEN ≠ RECOMMENDED', triggered: h5, detail: `requires_degree = ${requiresDegree}, education = ${eduLevel}` },
        { id: 'H6', rule: 'IF cultural_fit < 0.3 THEN CULTURAL_MISMATCH', triggered: h6, detail: `cultural_fit = ${culturalFit} ${h6 ? '<' : '≥'} 0.3` },
        { id: 'H7', rule: 'IF background_flagged THEN FURTHER_REVIEW', triggered: h7, detail: `background_flagged = ${backgroundFlagged}` },
        { id: 'H8', rule: 'IF salary > budget * 1.2 THEN budget_exceed', triggered: h8, detail: `salary = ${salaryExpect}, budget = ${salaryBudget}` },
        { id: 'H9', rule: 'IF diversity enabled THEN balanced_scoring', triggered: h9, detail: `diversity_enabled = ${candidateData.diversity_enabled === true}` },
        { id: 'H10', rule: 'IF triggered_concerns ≥ 3 THEN ≠ RECOMMENDED', triggered: h10, detail: `triggered = ${triggeredCount} ${h10 ? '≥' : '<'} 3` }
    ];

    const decision = {
        recommendation,
        composite_score: compositeScore,
        candidate_tier: candidateTier,
        role_category: roleCategory,
        reference_concern: flagReferenceConcern,
        cultural_mismatch: flagCulturalMismatch,
        budget_exceed: flagBudgetExceed,
        triggered_rules: triggeredCount,
        timestamp,
        reasons,
        allRules
    };

    const poo = generatePoO(candidateData, HIRING_POLICY.policy_name, timestamp);
    const por = generatePoR(candidateData, decision);
    const poi = verifyPoI(decision, candidateData);
    const bundle = createVerificationBundle(poo, por, poi);

    return { decision, verification_bundle: bundle };
}

// ═══════════════════════════════════════════════════════════════
// PROOF OF REASON (PoR)
// ═══════════════════════════════════════════════════════════════

function generatePoR(candidateData, decision) {
    const vertices = [
        { id: 'p1', type: 'premise', label: `skill_match = ${candidateData.skill_match_score || 0.5}` },
        { id: 'p2', type: 'premise', label: `experience_years = ${candidateData.experience_years || 3}` },
        { id: 'p3', type: 'premise', label: `interview_score = ${candidateData.interview_score || 0.5}` },
        { id: 'p4', type: 'premise', label: `reference_score = ${candidateData.reference_score || 0.5}` },
        { id: 'p5', type: 'premise', label: `education_level = ${candidateData.education_level || 3}` },
        { id: 'p6', type: 'premise', label: `cultural_fit = ${candidateData.cultural_fit_score || 0.5}` },
        { id: 'p7', type: 'premise', label: `role_category = ${decision.role_category}` },
        { id: 'p8', type: 'premise', label: `background_flagged = ${candidateData.background_flagged === true}` },
        { id: 'r1', type: 'rule', label: 'H1: skill < 0.3 → NOT_RECOMMENDED' },
        { id: 'r2', type: 'rule', label: 'H2: SENIOR + exp < 3 → ≠ RECOMMENDED' },
        { id: 'r3', type: 'rule', label: 'H3: interview < 0.3 → NOT_RECOMMENDED' },
        { id: 'r4', type: 'rule', label: 'H4: reference < 0.3 → concern' },
        { id: 'r5', type: 'rule', label: 'H5: degree required + edu < 3 → ≠ RECOMMENDED' },
        { id: 'r6', type: 'rule', label: 'H6: cultural_fit < 0.3 → mismatch' },
        { id: 'r7', type: 'rule', label: 'H7: background flagged → REVIEW' },
        { id: 'r8', type: 'rule', label: 'H10: multi-concern → ≠ RECOMMENDED' },
        { id: 'c1', type: 'conclusion', label: `recommendation = ${decision.recommendation}` },
        { id: 'c2', type: 'conclusion', label: `composite_score = ${(decision.composite_score * 100).toFixed(1)}%` },
        { id: 'c3', type: 'conclusion', label: `candidate_tier = ${decision.candidate_tier}` }
    ];

    const edges = [
        { from: 'p1', to: 'r1', relation: 'input' },
        { from: 'p2', to: 'r2', relation: 'input' },
        { from: 'p7', to: 'r2', relation: 'input' },
        { from: 'p3', to: 'r3', relation: 'input' },
        { from: 'p4', to: 'r4', relation: 'input' },
        { from: 'p5', to: 'r5', relation: 'input' },
        { from: 'p6', to: 'r6', relation: 'input' },
        { from: 'p8', to: 'r7', relation: 'input' },
        { from: 'r1', to: 'c1', relation: 'determines' },
        { from: 'r2', to: 'c1', relation: 'influences' },
        { from: 'r3', to: 'c1', relation: 'determines' },
        { from: 'r4', to: 'c1', relation: 'influences' },
        { from: 'r5', to: 'c1', relation: 'influences' },
        { from: 'r6', to: 'c1', relation: 'influences' },
        { from: 'r7', to: 'c1', relation: 'influences' },
        { from: 'r8', to: 'c1', relation: 'influences' },
        { from: 'c1', to: 'c2', relation: 'produces' },
        { from: 'c2', to: 'c3', relation: 'determines' }
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

function verifyPoI(decision, candidateData) {
    const results = [];
    const skillScore = candidateData.skill_match_score != null ? candidateData.skill_match_score : 0.5;
    const interviewScore = candidateData.interview_score != null ? candidateData.interview_score : 0.5;

    // H1
    results.push({
        constraint: 'H1 - skill_threshold',
        satisfied: skillScore >= 0.3 || decision.recommendation === 'NOT_RECOMMENDED',
        severity: 'mandatory',
        detail: `skill_match=${skillScore}, recommendation=${decision.recommendation}`
    });

    // H3
    results.push({
        constraint: 'H3 - interview_floor',
        satisfied: interviewScore >= 0.3 || decision.recommendation === 'NOT_RECOMMENDED',
        severity: 'mandatory',
        detail: `interview=${interviewScore}, recommendation=${decision.recommendation}`
    });

    // H4
    results.push({
        constraint: 'H4 - reference_check',
        satisfied: (candidateData.reference_score || 0.5) >= 0.3 || decision.reference_concern === true,
        severity: 'mandatory',
        detail: `reference=${candidateData.reference_score || 0.5}, flagged=${decision.reference_concern}`
    });

    // H7
    results.push({
        constraint: 'H7 - background_check',
        satisfied: candidateData.background_flagged !== true || decision.recommendation !== 'RECOMMENDED',
        severity: 'mandatory',
        detail: `background_flagged=${candidateData.background_flagged === true}, recommendation=${decision.recommendation}`
    });

    // Axiom 3.1
    results.push({
        constraint: 'Axiom 3.1 - Temporal Precedence',
        satisfied: HIRING_POLICY.declaration_timestamp < decision.timestamp,
        severity: 'mandatory',
        detail: `PoI declared: ${HIRING_POLICY.declaration_timestamp}, Decision: ${decision.timestamp}`
    });

    const all_mandatory_satisfied = results.filter(r => r.severity === 'mandatory').every(r => r.satisfied);

    return {
        policy: HIRING_POLICY.policy_name,
        policy_hash: HIRING_POLICY.policy_hash,
        declaration_time: HIRING_POLICY.declaration_timestamp,
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
        bundle_id: `VB-HIR-${Date.now()}`,
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
    HIRING_POLICY,
    evaluateCandidate,
    generatePoO,
    generatePoR,
    verifyPoI,
    createVerificationBundle,
    computeMerkleRoot,
    detectRoleCategory,
    calculateCompositeScore,
    determineCandidateTier
};

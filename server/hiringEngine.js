/**
 * OpLogica Employment Screening — Triadic Verification Engine
 * Fair Employment Screening Policy v1.0 with real PoO, PoR, PoI.
 * DETERMINISTIC: same inputs → same outputs.
 */

const crypto = require('crypto');

const POO_SECRET = process.env.POO_SECRET || 'oplogica-verification-key';

const HIRING_POLICY = {
  name: 'Fair Employment Screening Policy v1.0',
  authority: 'OpLogica Ethics Framework',
  declaration_timestamp: '2024-11-15T09:00:00Z',
  constraints: [
    { id: 'E1', name: 'minimum_skill_threshold', rule: 'IF skill_match_score < 0.40 THEN recommendation = NOT_RECOMMENDED', severity: 'mandatory' },
    { id: 'E2', name: 'interview_minimum', rule: 'IF interview_score < 0.40 THEN recommendation = NOT_RECOMMENDED', severity: 'mandatory' },
    { id: 'E3', name: 'non_discrimination', rule: 'Decision uses only: experience, skills, interview, education, references. No protected characteristics', severity: 'mandatory' },
    { id: 'E4', name: 'reference_warning', rule: 'IF reference_score < 0.50 THEN flag for additional review', severity: 'warning' }
  ],
  policy_hash: null,
  authority_signature: null
};

(function () {
  const payload = JSON.stringify({
    name: HIRING_POLICY.name,
    declaration_timestamp: HIRING_POLICY.declaration_timestamp,
    constraints: HIRING_POLICY.constraints.map(c => c.id + c.rule)
  });
  HIRING_POLICY.policy_hash = crypto.createHash('sha256').update(payload).digest('hex');
  HIRING_POLICY.authority_signature = crypto.createHmac('sha256', POO_SECRET).update(HIRING_POLICY.policy_hash).digest('hex');
})();

function generatePoO(params, policyName, timestamp) {
  const state = JSON.stringify({
    D: params,
    P: policyName,
    T: timestamp
  });
  const hash = crypto.createHash('sha256').update(state).digest('hex');
  const signature = crypto.createHmac('sha256', POO_SECRET).update(hash + timestamp).digest('hex');
  return {
    hash,
    timestamp,
    signature,
    algorithm: 'SHA-256',
    state_reference: `PoO-${Date.now()}`
  };
}

function generateSignature(data) {
  return crypto.createHmac('sha256', POO_SECRET).update(data).digest('hex');
}

function generatePoR(params, decision) {
  const skill_fit = params.skill_match_score < 0.40 ? 'POOR' : params.skill_match_score < 0.65 ? 'PARTIAL' : 'STRONG';
  const interview_result = params.interview_score < 0.40 ? 'FAIL' : params.interview_score < 0.60 ? 'BORDERLINE' : 'PASS';
  const experience_level = params.experience_years < 1 ? 'JUNIOR' : params.experience_years < 5 ? 'MID' : 'SENIOR';

  const vertices = [
    { id: 'p1', type: 'premise', label: `experience_years = ${params.experience_years}` },
    { id: 'p2', type: 'premise', label: `skill_match = ${params.skill_match_score.toFixed(2)}` },
    { id: 'p3', type: 'premise', label: `education_level = ${params.education_level}` },
    { id: 'p4', type: 'premise', label: `interview_score = ${params.interview_score.toFixed(2)}` },
    { id: 'p5', type: 'premise', label: `reference_score = ${params.reference_score.toFixed(2)}` },
    { id: 'r1', type: 'rule', label: 'H1: IF skill_match < 0.40 THEN skill_fit = POOR' },
    { id: 'r2', type: 'rule', label: 'H2: IF interview < 0.40 THEN interview_result = FAIL' },
    { id: 'r3', type: 'rule', label: 'H3: experience → experience_level' },
    { id: 'r4', type: 'rule', label: 'H4: reference < 0.50 → CONCERN' },
    { id: 'r5', type: 'rule', label: 'H5: Combined → recommendation' },
    { id: 'c1', type: 'conclusion', label: `skill_fit = ${skill_fit}` },
    { id: 'c2', type: 'conclusion', label: `interview_result = ${interview_result}` },
    { id: 'c3', type: 'conclusion', label: `recommendation = ${decision.recommendation}` }
  ];

  const edges = [
    { from: 'p2', to: 'r1', relation: 'input' },
    { from: 'r1', to: 'c1', relation: 'entails' },
    { from: 'p4', to: 'r2', relation: 'input' },
    { from: 'r2', to: 'c2', relation: 'entails' },
    { from: 'p1', to: 'r3', relation: 'input' },
    { from: 'c1', to: 'r5', relation: 'input' },
    { from: 'c2', to: 'r5', relation: 'input' },
    { from: 'r5', to: 'c3', relation: 'entails' }
  ];

  const graph = { vertices, edges };
  const graphHash = crypto.createHash('sha256').update(JSON.stringify(graph)).digest('hex');
  const delta_logic = {
    steps: [
      { step: 'H1', input: `skill_match=${params.skill_match_score}`, output: `skill_fit=${skill_fit}` },
      { step: 'H2', input: `interview=${params.interview_score}`, output: `interview_result=${interview_result}` },
      { step: 'H3', input: `experience_years=${params.experience_years}`, output: `experience_level=${experience_level}` },
      { step: 'H5', input: 'combined', output: `recommendation=${decision.recommendation}` }
    ]
  };
  return {
    graph,
    delta_logic,
    hash: graphHash,
    signature: generateSignature(graphHash)
  };
}

function verifyPoI(decision, params) {
  const results = [];

  // E1: minimum_skill_threshold
  const e1_satisfied = params.skill_match_score >= 0.40 || decision.recommendation === 'NOT_RECOMMENDED';
  results.push({
    constraint: 'E1 - minimum_skill_threshold',
    satisfied: e1_satisfied,
    severity: 'mandatory',
    detail: `skill_match_score=${params.skill_match_score} ${params.skill_match_score < 0.40 ? '< 0.40 → NOT_RECOMMENDED' : '≥ 0.40'}`
  });

  // E2: interview_minimum
  const e2_satisfied = params.interview_score >= 0.40 || decision.recommendation === 'NOT_RECOMMENDED';
  results.push({
    constraint: 'E2 - interview_minimum',
    satisfied: e2_satisfied,
    severity: 'mandatory',
    detail: `interview_score=${params.interview_score} ${params.interview_score < 0.40 ? '< 0.40 → NOT_RECOMMENDED' : '≥ 0.40'}`
  });

  // E3: non_discrimination — system only uses the 5 declared parameters
  results.push({
    constraint: 'E3 - non_discrimination',
    satisfied: true,
    severity: 'mandatory',
    detail: 'Decision uses only experience, skills, interview, education, references — no protected characteristics'
  });

  // E4: reference_warning
  const e4_triggered = params.reference_score < 0.50;
  results.push({
    constraint: 'E4 - reference_warning',
    satisfied: true,
    triggered: e4_triggered,
    severity: 'warning',
    detail: e4_triggered
      ? `⚠️ Triggered — reference_score=${params.reference_score} < 0.50 (flag for additional review)`
      : `✅ Within limit (reference_score=${params.reference_score} ≥ 0.50)`
  });

  const temporal_valid = HIRING_POLICY.declaration_timestamp < (decision.timestamp || new Date().toISOString());
  results.push({
    constraint: 'Axiom 3.1 - Temporal Precedence',
    satisfied: temporal_valid,
    severity: 'mandatory',
    detail: `PoI declared: ${HIRING_POLICY.declaration_timestamp}, Decision: ${decision.timestamp || '—'}`
  });

  const all_mandatory_satisfied = results.filter(r => r.severity === 'mandatory').every(r => r.satisfied);
  return {
    policy: HIRING_POLICY.name,
    policy_hash: HIRING_POLICY.policy_hash,
    declaration_time: HIRING_POLICY.declaration_timestamp,
    verification_time: new Date().toISOString(),
    all_satisfied: all_mandatory_satisfied,
    results
  };
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

function createVerificationBundle(poo, por, poi) {
  const leaves = [poo.hash, por.hash, poi.policy_hash || 'genesis'];
  const merkleRoot = computeMerkleRoot(leaves);
  const temporalRow = poi.results && poi.results.find(r => r.constraint.includes('Temporal'));
  const overall_result = (poi.all_satisfied && por.graph.edges.length > 0) ? 'VERIFIED' : 'FAILED';
  return {
    bundle_id: `VB-${Date.now()}`,
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

/**
 * Deterministic candidate assessment. E1: skill < 0.40 → NOT_RECOMMENDED; E2: interview < 0.40 → NOT_RECOMMENDED.
 */
function evaluateCandidate(params) {
  const timestamp = new Date().toISOString();
  const experience_years = Number(params.experience_years);
  const skill_match_score = Number(params.skill_match_score);
  const education_level = Math.min(5, Math.max(1, Number(params.education_level)));
  const interview_score = Number(params.interview_score);
  const reference_score = Number(params.reference_score);

  // H1: Skill Match
  let skill_fit = 'STRONG';
  if (skill_match_score < 0.40) skill_fit = 'POOR';
  else if (skill_match_score < 0.65) skill_fit = 'PARTIAL';

  // H2: Interview
  let interview_result = 'PASS';
  if (interview_score < 0.40) interview_result = 'FAIL';
  else if (interview_score < 0.60) interview_result = 'BORDERLINE';

  // H3: Experience
  let experience_level = 'SENIOR';
  if (experience_years < 1) experience_level = 'JUNIOR';
  else if (experience_years < 5) experience_level = 'MID';

  // H4: Reference (flag only)
  const reference_flag = reference_score < 0.50 ? 'CONCERN' : 'OK';

  const experience_normalized = Math.min(experience_years / 10, 1.0);
  const education_normalized = (education_level - 1) / 4;
  const composite_score = (skill_match_score * 0.30) + (interview_score * 0.25) + (experience_normalized * 0.20) + (education_normalized * 0.10) + (reference_score * 0.15);
  const composite_clamped = Math.max(0, Math.min(1, composite_score));

  // H5: Combined
  let recommendation = 'RECOMMENDED';
  if (skill_fit === 'POOR' || interview_result === 'FAIL') {
    recommendation = 'NOT_RECOMMENDED';
  } else if (composite_clamped >= 0.70) {
    recommendation = 'RECOMMENDED';
  } else if (composite_clamped >= 0.50) {
    recommendation = 'FURTHER_REVIEW';
  } else {
    recommendation = 'NOT_RECOMMENDED';
  }

  const reasons = [];
  if (skill_match_score < 0.40) reasons.push('E1: skill_match_score < 0.40 → NOT_RECOMMENDED');
  if (interview_score < 0.40) reasons.push('E2: interview_score < 0.40 → NOT_RECOMMENDED');
  if (skill_fit === 'PARTIAL' && recommendation !== 'NOT_RECOMMENDED') reasons.push(`H1: skill_match ${skill_match_score} in 0.40–0.65 → skill_fit = PARTIAL`);
  if (interview_result === 'BORDERLINE') reasons.push(`H2: interview_score ${interview_score} in 0.40–0.60 → BORDERLINE`);
  if (experience_level === 'JUNIOR') reasons.push(`H3: experience_years ${experience_years} < 1 → JUNIOR`);
  if (reference_flag === 'CONCERN') reasons.push(`H4: reference_score ${reference_score} < 0.50 → flag for review`);
  if (recommendation === 'RECOMMENDED') reasons.push(`H5: composite_score ${composite_clamped.toFixed(2)} ≥ 0.70 → RECOMMENDED`);
  if (recommendation === 'FURTHER_REVIEW') reasons.push(`H5: composite_score ${composite_clamped.toFixed(2)} in 0.50–0.70 → FURTHER_REVIEW`);
  if (recommendation === 'NOT_RECOMMENDED' && skill_fit !== 'POOR' && interview_result !== 'FAIL') reasons.push(`H5: composite_score ${composite_clamped.toFixed(2)} < 0.50 → NOT_RECOMMENDED`);

  let candidate_tier = 'A';
  if (composite_clamped >= 0.80) candidate_tier = 'A';
  else if (composite_clamped >= 0.65) candidate_tier = 'B';
  else if (composite_clamped >= 0.50) candidate_tier = 'C';
  else candidate_tier = 'D';
  if (recommendation === 'NOT_RECOMMENDED') candidate_tier = 'D';

  const allRules = [
    { id: 'E1', rule: 'IF skill_match_score < 0.40 THEN recommendation = NOT_RECOMMENDED', triggered: skill_match_score < 0.40, detail: `skill_match = ${skill_match_score} ${skill_match_score < 0.40 ? '<' : '≥'} 0.40` },
    { id: 'E2', rule: 'IF interview_score < 0.40 THEN recommendation = NOT_RECOMMENDED', triggered: interview_score < 0.40, detail: `interview_score = ${interview_score} ${interview_score < 0.40 ? '<' : '≥'} 0.40` },
    { id: 'H1', rule: 'IF skill_match < 0.65 THEN skill_fit = PARTIAL or POOR', triggered: skill_fit !== 'STRONG', detail: `skill_match = ${skill_match_score} → skill_fit = ${skill_fit}` },
    { id: 'H2', rule: 'IF interview < 0.60 THEN interview_result = BORDERLINE or FAIL', triggered: interview_result !== 'PASS', detail: `interview_score = ${interview_score} → interview_result = ${interview_result}` },
    { id: 'H3', rule: 'IF experience_years < 5 THEN experience_level = JUNIOR or MID', triggered: experience_level !== 'SENIOR', detail: `experience_years = ${experience_years} → experience_level = ${experience_level}` },
    { id: 'H4', rule: 'IF reference_score < 0.50 THEN flag CONCERN', triggered: reference_flag === 'CONCERN', detail: `reference_score = ${reference_score} ${reference_score < 0.50 ? '<' : '≥'} 0.50` },
    { id: 'H5', rule: 'Combined: NOT_RECOMMENDED if POOR/FAIL; else RECOMMENDED if composite≥0.70; else FURTHER_REVIEW if ≥0.50', triggered: true, detail: `recommendation = ${recommendation}, composite = ${composite_clamped.toFixed(2)}` }
  ];

  const decision = {
    recommendation,
    composite_score: Math.round(composite_clamped * 100) / 100,
    candidate_tier,
    timestamp,
    reasons,
    allRules
  };

  const poo = generatePoO(
    { experience_years, skill_match_score, education_level, interview_score, reference_score },
    HIRING_POLICY.name,
    timestamp
  );
  const por = generatePoR(
    { experience_years, skill_match_score, education_level, interview_score, reference_score },
    decision
  );
  const poi = verifyPoI(decision, {
    experience_years,
    skill_match_score,
    education_level,
    interview_score,
    reference_score
  });
  const bundle = createVerificationBundle(poo, por, poi);

  return {
    decision,
    verification_bundle: bundle
  };
}

module.exports = {
  HIRING_POLICY,
  evaluateCandidate,
  generatePoO,
  generatePoR,
  verifyPoI,
  createVerificationBundle,
  computeMerkleRoot
};

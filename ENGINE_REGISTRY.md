# OpLogica Engine Registry

> **Version:** 2.0.0 | **Engines:** 6 | **Total Rules:** 60 | **Verification:** Triadic (PoO · PoR · PoI)

---

## Engine Overview

| # | Engine | File | Sector | Version | Rules | Decision Outcomes |
|---|--------|------|--------|---------|-------|-------------------|
| 1 | 🏥 Medical Triage | `server/medicalEngine.js` | Healthcare | v3.0 | 10 | `HIGH` · `MEDIUM` · `LOW` |
| 2 | ⚖️ Legal Compliance | `server/legalEngine.js` | Legal | v1.0 | 10 | `APPROVED` · `REJECTED` · `FURTHER_REVIEW` |
| 3 | 🏛️ Government Service | `server/governmentEngine.js` | Governance | v1.0 | 10 | `APPROVED` · `REJECTED` · `FURTHER_REVIEW` |
| 4 | 💰 Credit Assessment | `server/creditEngine.js` | Finance | v2.0 | 10 | `APPROVED` · `DENIED` · `MANUAL_REVIEW` |
| 5 | 👥 Hiring Assessment | `server/hiringEngine.js` | Employment | v2.0 | 10 | `RECOMMENDED` · `NOT_RECOMMENDED` · `FURTHER_REVIEW` |
| 6 | 🏗️ Permit Assessment | `server/permitEngine.js` | Regulatory | v2.0 | 10 | `APPROVED` · `DENIED` · `CONDITIONAL_APPROVAL` |

---

## Triadic Verification Architecture

Every engine produces a **Verification Bundle** containing three cryptographic proofs:

```
Input → [Engine] → Decision
                      ├── PoO (Proof of Origin)    — SHA-256 hash of input state
                      ├── PoR (Proof of Reason)    — Directed acyclic reason graph
                      ├── PoI (Proof of Intent)    — Policy compliance verification
                      └── Merkle Root              — Bundle integrity seal
```

- **PoO:** Captures the exact input state at decision time with HMAC signature
- **PoR:** Builds a traceable graph (premises → rules → conclusions) with edges
- **PoI:** Verifies the decision satisfies all pre-declared policy constraints
- **Axiom 3.1:** Policy must be declared *before* any decision (Temporal Precedence)

---

## 1. 🏥 Medical Triage Engine v3.0

**Entry point:** `evaluateMedical(patientData)` (alias: `triageDecision`)

**Categories:** General · Pediatric · Geriatric · Maternal · Trauma

**Rules:**

| ID | Rule | Severity |
|----|------|----------|
| C1 | vital_score < 0.5 → priority = HIGH | mandatory |
| R-AGE | age ≥ 65 → risk ELEVATED | mandatory |
| R-COMORBID | comorbidity ≥ 0.6 → risk HIGH | mandatory |
| R-URGENCY | critical + wait > 30 → IMMEDIATE | mandatory |
| C3 | wait_time > 60 → reassessment | warning |
| C5 | pediatric + vital < 0.6 → MEDIUM+ | mandatory |
| C6 | geriatric + comorbidity ≥ 0.5 → MEDIUM+ | mandatory |
| C7 | trauma ≥ 0.7 → HIGH | mandatory |
| C8 | maternal + complications → HIGH | mandatory |
| C9 | resource < 0.3 → alert | warning |
| C10 | triggered ≥ 3 → MEDIUM+ | mandatory |

### Example

**Input:**
```json
{
  "vital_score": 0.35,
  "age": 72,
  "comorbidity_index": 0.7,
  "wait_time": 45,
  "resource_score": 0.6
}
```

**Output:**
```json
{
  "decision": {
    "priority": "HIGH",
    "critical": true,
    "urgency": "IMMEDIATE",
    "reassessment": false,
    "category": "GERIATRIC",
    "risk_score": 0.5870,
    "triggered_rules": 5
  },
  "verification_bundle": {
    "overall_result": "VERIFIED",
    "merkle_root": "a3f8..."
  }
}
```

**⚠️ Disclaimer:** This engine provides decision-support analysis only. It does not constitute medical advice, diagnosis, or treatment. All outputs must be reviewed by qualified healthcare professionals before clinical action.

---

## 2. ⚖️ Legal Compliance Engine v1.0

**Entry point:** `evaluateLegal(caseData)`

**Case Types:** Contract · Regulatory · Liability · General

**Rules:**

| ID | Rule | Severity |
|----|------|----------|
| L1 | contract_validity < 0.4 → REJECTED | mandatory |
| L2 | regulatory_compliance < 0.5 → non_compliant | mandatory |
| L3 | liability_exposure > 0.7 → risk HIGH | mandatory |
| L4 | jurisdiction unrecognized → REJECTED | mandatory |
| L5 | outside statute of limitations → REJECTED | mandatory |
| L6 | evidence < 0.3 → ≠ APPROVED | mandatory |
| L7 | conflict_of_interest → flag | warning |
| L8 | precedent_alignment < 0.4 → risk MEDIUM+ | mandatory |
| L9 | financial_exposure > threshold → senior_review | warning |
| L10 | triggered ≥ 3 → risk MEDIUM+ | mandatory |

### Example

**Input:**
```json
{
  "contract_validity": 0.8,
  "regulatory_compliance": 0.3,
  "liability_exposure": 0.75,
  "evidence_score": 0.6,
  "precedent_alignment": 0.7,
  "jurisdiction_recognized": true,
  "within_statute": true,
  "financial_exposure": 250000,
  "financial_threshold": 100000
}
```

**Output:**
```json
{
  "decision": {
    "recommendation": "FURTHER_REVIEW",
    "risk_level": "HIGH",
    "risk_score": 0.3850,
    "case_type": "LIABILITY",
    "non_compliant": true,
    "senior_review_required": true,
    "triggered_rules": 4
  },
  "verification_bundle": {
    "overall_result": "VERIFIED",
    "merkle_root": "b7c2..."
  }
}
```

**⚠️ Disclaimer:** This engine provides legal compliance analysis for decision-support only. It does not constitute legal advice. All outputs must be reviewed by qualified legal professionals before action.

---

## 3. 🏛️ Government Service Engine v1.0

**Entry point:** `evaluateGovernment(requestData)`

**Service Types:** License · Benefit · Permit · Registration · General

**Rules:**

| ID | Rule | Severity |
|----|------|----------|
| G1 | identity unverified → REJECTED | mandatory |
| G2 | eligibility < 0.4 → REJECTED | mandatory |
| G3 | documentation < 0.5 → INCOMPLETE | mandatory |
| G4 | residency unverified + required → REJECTED | mandatory |
| G5 | tax non-compliant → tax_hold | mandatory |
| G6 | criminal flagged + clearance required → REVIEW | mandatory |
| G7 | duplicate detected → REJECTED | mandatory |
| G8 | capacity < 0.2 → capacity_warning | warning |
| G9 | priority_group → ELEVATED processing | mandatory |
| G10 | triggered ≥ 3 → ≠ APPROVED | mandatory |

### Example

**Input:**
```json
{
  "identity_verified": true,
  "eligibility_score": 0.8,
  "documentation_score": 0.9,
  "residency_verified": true,
  "tax_compliant": true,
  "criminal_flagged": false,
  "duplicate_detected": false,
  "service_capacity": 0.7,
  "priority_group": true,
  "service_type": "LICENSE"
}
```

**Output:**
```json
{
  "decision": {
    "recommendation": "APPROVED",
    "status": "COMPLETE",
    "compliance_score": 0.9500,
    "service_type": "LICENSE",
    "processing_priority": "ELEVATED",
    "triggered_rules": 1
  },
  "verification_bundle": {
    "overall_result": "VERIFIED",
    "merkle_root": "c4d1..."
  }
}
```

**⚠️ Disclaimer:** This engine provides eligibility and compliance analysis for decision-support only. It does not represent official government decisions. All outputs must be reviewed by authorized public servants before action.

---

## 4. 💰 Credit Assessment Engine v2.0

**Entry point:** `evaluateCredit(applicantData)`

**Loan Types:** Personal · Mortgage · Business · Auto · Education

**Rules:**

| ID | Rule | Severity |
|----|------|----------|
| F1 | credit_score < 500 → DENIED | mandatory |
| F2 | debt_to_income > 0.50 → DENIED | mandatory |
| F3 | annual_income < 20000 → risk MEDIUM+ | mandatory |
| F4 | loan/income > 5.0 → ≠ APPROVED | mandatory |
| F5 | employment < 1yr → risk ELEVATED | mandatory |
| F6 | MORTGAGE + collateral < 0.8 → undercollateralized | mandatory |
| F7 | bankruptcy → risk HIGH | mandatory |
| F8 | payment_history < 0.4 → risk MEDIUM+ | mandatory |
| F9 | credit_utilization > 0.80 → risk ELEVATED | warning |
| F10 | triggered ≥ 3 → ≠ APPROVED | mandatory |

### Example

**Input:**
```json
{
  "credit_score": 720,
  "annual_income": 85000,
  "debt_to_income": 0.28,
  "loan_amount": 25000,
  "employment_years": 5,
  "payment_history_score": 0.85,
  "credit_utilization": 0.35
}
```

**Output:**
```json
{
  "decision": {
    "recommendation": "APPROVED",
    "risk_level": "LOW",
    "risk_score": 0.2145,
    "loan_type": "PERSONAL",
    "interest_rate_tier": "PRIME_PLUS",
    "loan_to_income_ratio": 0.29,
    "triggered_rules": 0
  },
  "verification_bundle": {
    "overall_result": "VERIFIED",
    "merkle_root": "d9e5..."
  }
}
```

**⚠️ Disclaimer:** This engine provides financial risk analysis for decision-support only. It does not constitute financial advice or a lending commitment. All outputs must be reviewed by qualified financial professionals before credit decisions.

---

## 5. 👥 Hiring Assessment Engine v2.0

**Entry point:** `evaluateCandidate(candidateData)`

**Role Categories:** Technical · Executive · Operations · Creative · Entry-Level

**Rules:**

| ID | Rule | Severity |
|----|------|----------|
| H1 | skill_match < 0.3 → NOT_RECOMMENDED | mandatory |
| H2 | SENIOR + experience < 3yr → ≠ RECOMMENDED | mandatory |
| H3 | interview < 0.3 → NOT_RECOMMENDED | mandatory |
| H4 | reference < 0.3 → flag_concern | mandatory |
| H5 | requires_degree + education < 3 → ≠ RECOMMENDED | mandatory |
| H6 | cultural_fit < 0.3 → CULTURAL_MISMATCH | warning |
| H7 | background_flagged → FURTHER_REVIEW | mandatory |
| H8 | salary > budget × 1.2 → budget_exceed | warning |
| H9 | diversity enabled → balanced_scoring | mandatory |
| H10 | triggered ≥ 3 → ≠ RECOMMENDED | mandatory |

### Example

**Input:**
```json
{
  "skill_match_score": 0.85,
  "experience_years": 7,
  "interview_score": 0.9,
  "reference_score": 0.8,
  "education_level": 4,
  "cultural_fit_score": 0.75,
  "role_category": "TECHNICAL"
}
```

**Output:**
```json
{
  "decision": {
    "recommendation": "RECOMMENDED",
    "composite_score": 0.8230,
    "candidate_tier": "STRONG",
    "role_category": "TECHNICAL",
    "triggered_rules": 0
  },
  "verification_bundle": {
    "overall_result": "VERIFIED",
    "merkle_root": "e1f7..."
  }
}
```

**⚠️ Disclaimer:** This engine provides candidate assessment analysis for decision-support only. It does not constitute an employment decision. All outputs must be reviewed by qualified HR professionals. Hiring decisions must comply with applicable anti-discrimination laws.

---

## 6. 🏗️ Permit Assessment Engine v2.0

**Entry point:** `evaluatePermit(permitData)`

**Permit Types:** Residential · Commercial · Industrial · Infrastructure · Renovation

**Rules:**

| ID | Rule | Severity |
|----|------|----------|
| P1 | zoning < 0.4 → DENIED | mandatory |
| P2 | structural < 0.5 → DENIED | mandatory |
| P3 | environmental > 0.7 → env_review | mandatory |
| P4 | fire_safety < 0.5 → ≠ APPROVED | mandatory |
| P5 | coverage > 0.80 → overcoverage | mandatory |
| P6 | accessibility < 0.4 + ≠ RENOVATION → ≠ APPROVED | mandatory |
| P7 | utility < 0.3 → utility_constraint | warning |
| P8 | heritage_zone + compliance < 0.6 → DENIED | mandatory |
| P9 | traffic > 0.7 → traffic_study | warning |
| P10 | violations ≥ 3 → DENIED | mandatory |

### Example

**Input:**
```json
{
  "zoning_compliance": 0.85,
  "structural_safety": 0.9,
  "environmental_impact": 0.25,
  "fire_safety_score": 0.8,
  "plot_coverage_ratio": 0.55,
  "accessibility_score": 0.7,
  "utility_capacity": 0.6,
  "permit_type": "COMMERCIAL"
}
```

**Output:**
```json
{
  "decision": {
    "recommendation": "APPROVED",
    "permit_score": 0.7825,
    "permit_class": "CLASS_B",
    "permit_type": "COMMERCIAL",
    "triggered_rules": 0
  },
  "verification_bundle": {
    "overall_result": "VERIFIED",
    "merkle_root": "f2a8..."
  }
}
```

**⚠️ Disclaimer:** This engine provides building and operational permit analysis for decision-support only. It does not constitute an official permit approval. All outputs must be reviewed by authorized regulatory bodies before issuance.

---

## Running Tests

```bash
# Test individual engine
node -e "const e = require('./server/medicalEngine'); console.log(JSON.stringify(e.evaluateMedical({vital_score:0.3,age:70,comorbidity_index:0.7,wait_time:45,resource_score:0.6}), null, 2))"

# Test all engines
node -e "
const med = require('./server/medicalEngine');
const leg = require('./server/legalEngine');
const gov = require('./server/governmentEngine');
const crd = require('./server/creditEngine');
const hir = require('./server/hiringEngine');
const prm = require('./server/permitEngine');
console.log('Medical:', med.evaluateMedical({vital_score:0.3,age:70,comorbidity_index:0.7,wait_time:45,resource_score:0.6}).decision.priority);
console.log('Legal:', leg.evaluateLegal({contract_validity:0.8,regulatory_compliance:0.3,liability_exposure:0.75,evidence_score:0.6}).decision.recommendation);
console.log('Government:', gov.evaluateGovernment({identity_verified:true,eligibility_score:0.8,documentation_score:0.9}).decision.recommendation);
console.log('Credit:', crd.evaluateCredit({credit_score:720,annual_income:85000,debt_to_income:0.28,loan_amount:25000}).decision.recommendation);
console.log('Hiring:', hir.evaluateCandidate({skill_match_score:0.85,experience_years:7,interview_score:0.9}).decision.recommendation);
console.log('Permit:', prm.evaluatePermit({zoning_compliance:0.85,structural_safety:0.9,environmental_impact:0.25}).decision.recommendation);
"
```

---

## License

Apache 2.0 — See [LICENSE](./LICENSE)

## Citation

```
Mohamed Ibrahim (2025). OpLogica — AI Verification & Decision Intelligence Platform.
DOI: 10.5281/zenodo.17275281
```

---

*OpLogica — Where every decision is verified, every reason is traced, every intent is proven.*

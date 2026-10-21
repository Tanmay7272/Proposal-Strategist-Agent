# Request for Proposal: Patient Engagement & Digital Intake Modernization

**Issuer:** Horizon Health Network (HHN)  
**RFP No.:** HHN-2026-RFP-088  
**Release Date:** 10 October 2026  
**Response Deadline:** 18 November 2026  
**Primary Contact:** Office of Digital Transformation & Patient Access (rfp-response@horizonhealth.org)  

---

## 1. Executive Summary & Organizational Background

Horizon Health Network (HHN) is an integrated non-profit healthcare system comprising 18 acute care and community hospitals, 65 outpatient specialty clinics, and over 2,400 credentialed physicians across the tri-county metropolitan region. Annually, HHN serves approximately 1.4 million unique patients across 3.8 million outpatient and acute encounters.

Our current patient pre-registration and intake operations rely on a fragmented legacy system deployed in 2015. Patients are forced to complete repetitive physical paper forms or navigate an unintuitive web portal with less than 28% patient adoption. Front-desk staff spend an average of 14 minutes per check-in manually transcribing patient demographics and scanning insurance cards into two disjointed Electronic Health Record (EHR) instances (Epic in acute care and Oracle Cerner in acquired ambulatory clinics). 

In Q2 2026, an unannounced synchronization outage between intake servers and the central billing repository caused severe billing delays and a multi-week claims rejection backlog exceeding $12M. Furthermore, patient exit surveys cite long lobby wait times and redundant paperwork as the primary reason for switching to commercial urgent care competitors.

HHN's Board of Trustees has authorized a strategic initiative to replace all legacy front-end intake systems with a modern, mobile-first, unified patient engagement platform within 12 months.

---

## 2. Scope of Work

The selected vendor will deliver an enterprise-grade SaaS platform and associated implementation services covering:

1. **Unified Digital Pre-Registration & Mobile Check-In:** Self-service digital registration via smartphone (SMS/email link without requiring app-store download) and lobby kiosks, including ID capture, biometric identity verification option, and digital consent signature capture.
2. **Bi-Directional Real-Time EHR Integration:** Turnkey, real-time FHIR/HL7 bi-directional integration with both Epic (Hyperspace/MyChart) and Oracle Cerner systems, updating scheduling, insurance, and clinical questionnaires directly into clinician intake queues.
3. **Automated Eligibility & Co-Pay Estimation:** Real-time eligibility (270/271 EDI) verification and out-of-pocket co-pay calculation at the time of pre-registration, integrated with HHN's payment gateway (FirstHealth Merchant Services).
4. **Historical Data Migration:** Safe migration and reconciliation of 5 years of historical patient intake records, consent documents, and demographic archives (estimated 3.2 million patient files).
5. **Multi-Lingual Accessibility:** Full compliance with WCAG 2.1 AA accessibility guidelines, with complete localization in English, Spanish, Cantonese, and Vietnamese.
6. **Enterprise Change Management & Training:** Tailored training curriculum and role-based training delivery for 450 front-desk coordinators, clinic managers, and registration supervisors across all 18 hospitals and 65 clinics.
7. **Post Go-Live Support:** 24/7/365 Tier-3 technical support with guaranteed 15-minute response times for critical clinical intake disruptions.

---

## 3. Mandatory Technical & Compliance Requirements

Vendors must meet all mandatory requirements to be considered for evaluation:

- **M1. Data Security & Regulatory Attestation:** Platform must be HIPAA compliant, certified HITRUST CSF, and possess an active SOC 2 Type II report covering Security, Availability, and Confidentiality.
- **M2. Zero Workflow Disruption:** Phased deployment methodology ensuring zero clinical charting downtime or check-in interruption during clinic-by-clinic cutovers.
- **M3. High Availability SLA:** Minimum 99.99% system availability with automated failover and documented business continuity procedures.
- **M4. Dedicated Healthcare Leadership:** The vendor must assign a dedicated Project Director with a minimum of 7 years leading EHR-integrated health system deployments.
- **M5. Resilient Offline Intake Mode:** Front-desk kiosks and mobile intake workflows must support secure offline caching with automatic encryption and deferred synchronization for rural clinics facing intermittent fiber connectivity.

---

## 4. Evaluation Criteria & Scoring

Proposals will be evaluated by a joint committee of Clinical Leadership, Nursing Informatics, IT Infrastructure, and Revenue Cycle Operations:

| Evaluation Factor | Weight | Key Assessment Focus |
|---|---|---|
| **Technical Approach & Migration Plan** | **35%** | Architecture robustness, FHIR integration capability with Epic/Cerner, cutover safety, and offline resilience |
| **Past Performance & Verified References** | **25%** | Track record in 10+ hospital health systems, verified EHR references, and proven patient adoption rates (>65%) |
| **Team Qualifications & Governance** | **15%** | Healthcare clinical workflow expertise, dedicated staffing ratios, and change management rigor |
| **Commercial Terms & Total Cost of Ownership** | **25%** | Transparent 3-year pricing schedule, milestone-based payment structure, and absence of hidden change-order fees |

---

## 5. Submission Guidelines

Proposals must include:
- Section 1: Executive Summary (Strict 1-page limit; proposals exceeding 1 page for this section will receive a point deduction)
- Section 2: Technical Approach & EHR Integration Architecture
- Section 3: Implementation, Phased Cutover, and Risk Mitigation Plan
- Section 4: Team Qualifications, Organizational Chart, and Staff Resumes
- Section 5: Past Performance (Minimum 3 comparable health system client references)
- Section 6: Comprehensive Pricing Narrative and Commercial Schedule

---

## 6. Informal Context & Buyer Sentiment

During pre-RFP discovery sessions, internal stakeholders voiced critical priorities:
- **Chief Medical Officer:** *"Our doctors and nurses are already burning out from EHR screen fatigue. If this new platform adds even two extra clicks to clinical intake or disrupts morning clinic schedules, clinicians will revolt."*
- **VP of Revenue Cycle:** *"We are tired of vendors who promise a seamless out-of-the-box integration and then hit us with six-figure professional service change-orders when Epic APIs require custom field mapping."*
- **Incumbent Context:** The incumbent legacy vendor's contract expires in 10 months. They have been notoriously sluggish in supporting mobile-first workflows and have refused to offer modern FHIR-based bi-directional sync without punitive licensing fees.

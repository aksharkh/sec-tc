import type { AccessRequest, KsiMetric, NdaRecord, StandardItem, StandardQuestionnaire } from "@/lib/types";
import { DAY, HOUR, mulberry32 } from "@/lib/utils";
import { KSI_CHECKS, PRACTICES } from "./catalog";

/* All companies, agencies and people are fictional. Questionnaire wording is
   Northwind's own paraphrase of common CAIQ and SIG Lite topics, not the
   published question text. */

export const NDA_VERSION = "2026.1";

export const NDA_TEXT = `Northwind Cloud, Inc. ("Northwind") shares restricted security documents through this trust center so that agencies, their assessors and integrators can review Northwind Workbench.

1. Purpose. You may use restricted documents only to evaluate or oversee your organization's use of Northwind Workbench.

2. Confidentiality. Keep restricted documents confidential. Share them only with colleagues and contractors who need them for that purpose and who are bound by confidentiality obligations at least as strict as these.

3. No redistribution. Do not publish, resell or post restricted documents. Each download is watermarked with your name and the date and is logged.

4. Federal records. Nothing in these terms limits disclosures required by law, including the Freedom of Information Act, or an agency's records management duties. Northwind may ask to be notified before a disclosure where the law allows.

5. Term. These terms apply while you have access and for three years after it ends.

6. Return or deletion. When asked, delete restricted documents you no longer need, except copies you must keep under law or records policy.`;

export function seedNdaRecords(now: number, requests: AccessRequest[]): NdaRecord[] {
  const r = mulberry32(5150);
  return requests
    .filter((q) => q.nda && q.status !== "denied")
    .map((q, i) => {
      const signedAt = q.submittedAt;
      const old = now - new Date(signedAt).getTime() > 150 * DAY;
      return {
        id: `nda_${i + 1}`,
        name: q.name,
        email: q.email,
        organization: q.organization,
        signature: q.name,
        signedAt,
        version: old ? "2025.2" : NDA_VERSION,
        ip: `198.51.100.${20 + Math.floor(r() * 70)}`,
        requestId: q.id,
        status: "active" as const,
      };
    });
}

const AUTOMATION: Record<string, number> = {
  "KSI-CNA": 100,
  "KSI-SVC": 92,
  "KSI-IAM": 100,
  "KSI-MLA": 89,
  "KSI-CMT": 86,
  "KSI-PIY": 67,
  "KSI-TPR": 60,
  "KSI-CED": 75,
  "KSI-RPL": 80,
  "KSI-INR": 83,
};

export function seedKsi(now: number): KsiMetric[] {
  const r = mulberry32(31337);
  const today6 = new Date(now);
  today6.setHours(6, 0, 0, 0);
  const lastRun = today6.getTime() > now ? today6.getTime() - DAY : today6.getTime();
  return PRACTICES.map((p) => {
    const k = KSI_CHECKS[p.id]!;
    const trend = Array.from({ length: 30 }, (_, i) => {
      const daysAgo = 29 - i;
      if (p.id === "KSI-MLA" && daysAgo >= 11 && daysAgo <= 16) return Math.round(((k.checks - 1) / k.checks) * 100);
      if (p.id === "KSI-SVC" && daysAgo === 22) return Math.round(((k.checks - 1) / k.checks) * 100);
      return r() < 0.02 ? Math.round(((k.checks - 1) / k.checks) * 100) : 100;
    });
    trend[29] = 100;
    const automation = AUTOMATION[p.id] ?? 80;
    return {
      id: p.id,
      checks: k.checks,
      passing: k.checks,
      automation,
      lastValidated: new Date(lastRun).toISOString(),
      lastManualReview: automation < 100 ? new Date(now - (3 + Math.floor(r() * 40)) * DAY - 4 * HOUR).toISOString() : undefined,
      trend,
      note: p.id === "KSI-MLA" ? "One check failed for six days in late October while log retention moved to write-once storage. Fixed and validated since." : undefined,
    };
  });
}

type Seed = Omit<StandardItem, "id"> & { id?: string };

const CAIQ: Seed[] = [
  { id: "A&A-01.1", domain: "Audit and assurance", question: "Are audit and assurance policies documented, approved and reviewed at least once a year?", answer: "Yes", detail: "Reviewed every year by the Head of Security; last reviewed in September 2026.", docIds: ["infosec-policy"] },
  { id: "A&A-02.1", domain: "Audit and assurance", question: "Do independent auditors assess the service at least once a year?", answer: "Yes", detail: "Annual FedRAMP 20x assessment by Keystone Assurance Partners, plus a SOC 2 Type II examination.", docIds: ["independent-assessment-report", "soc2-type2"] },
  { id: "AIS-04.1", domain: "Application security", question: "Is security part of the software development lifecycle?", answer: "Yes", detail: "Threat modeling for new features, peer review, dependency and secret scanning, and signed builds.", docIds: ["sdlc-policy"] },
  { id: "AIS-07.1", domain: "Application security", question: "Are application vulnerabilities fixed within defined timeframes?", answer: "Yes", detail: "Critical within 15 days, high within 30, moderate within 90. Open items are tracked in the POA&M.", docIds: ["vulnerability-scan-summary", "poam"] },
  { id: "BCR-08.1", domain: "Business continuity", question: "Are backups taken regularly and restored in tests?", answer: "Yes", detail: "Continuous backups with point-in-time recovery; restores are tested every quarter.", docIds: ["bcdr-plan", "dr-test-results"] },
  { id: "BCR-11.1", domain: "Business continuity", question: "Is the continuity plan exercised at least once a year?", answer: "Yes", detail: "Region failover is tested twice a year. The last test recovered in 38 minutes against a 4-hour objective.", docIds: ["dr-test-results"] },
  { id: "CCC-01.1", domain: "Change control", question: "Are change management procedures documented and followed?", answer: "Yes", detail: "Every production change is reviewed, tested and deployed through the pipeline; emergency changes are reviewed within one business day.", docIds: ["change-management-policy"] },
  { id: "CCC-07.1", domain: "Change control", question: "Are unauthorized changes to production detected?", answer: "Yes", detail: "Configuration drift is detected continuously and alerts within 15 minutes.", docIds: ["significant-change-log", "ksi-validation-summary"] },
  { id: "CEK-03.1", domain: "Cryptography and key management", question: "Is data encrypted at rest with validated cryptographic modules?", answer: "Yes", detail: "AES-256 through FIPS 140-validated modules for all customer data and backups.", docIds: ["encryption-standard"] },
  { id: "CEK-10.1", domain: "Cryptography and key management", question: "Are encryption keys rotated on a schedule?", answer: "Yes", detail: "Data keys rotate every 12 months, and immediately if compromise is suspected.", docIds: ["encryption-standard"] },
  { id: "CEK-20.1", domain: "Cryptography and key management", question: "Can customers manage their own encryption keys?", answer: "Partial", detail: "Keys are held by Northwind in a managed HSM today. Customer-managed keys are planned for 2027.", docIds: ["encryption-standard"] },
  { id: "DCS-01.1", domain: "Datacenter security", question: "Are physical datacenter controls in place?", answer: "Yes", detail: "Inherited from Meridian Federal Cloud, which holds its own FedRAMP 20x certification.", docIds: ["system-boundary", "customer-responsibility-matrix"] },
  { id: "DSP-05.1", domain: "Data security and privacy", question: "Is there an up-to-date inventory of data flows?", answer: "Yes", detail: "Maintained with the boundary diagram and reviewed after every significant change.", docIds: ["system-boundary"] },
  { id: "DSP-16.1", domain: "Data security and privacy", question: "Is data kept and deleted according to documented periods?", answer: "Yes", detail: "Agency data is deleted within 30 days of contract end; backups expire within 35 days.", docIds: ["data-retention-policy"] },
  { id: "GRC-05.1", domain: "Governance and risk", question: "Is there an information security program with named roles?", answer: "Yes", detail: "Led by the Head of Security, with an annual risk assessment and quarterly reviews.", docIds: ["infosec-policy"] },
  { id: "HRS-02.1", domain: "Human resources", question: "Are background checks done for staff with production access?", answer: "Yes", detail: "Background checks for all staff; production access is limited to US persons in the United States.", docIds: ["access-control-policy"] },
  { id: "HRS-11.1", domain: "Human resources", question: "Is security awareness training given at least once a year?", answer: "Yes", detail: "Annual training for everyone plus role-based training and quarterly phishing exercises.", docIds: ["security-training"] },
  { id: "IAM-02.1", domain: "Identity and access", question: "Are access management policies documented and reviewed every year?", answer: "Yes", detail: "Reviewed annually and after organizational changes.", docIds: ["access-control-policy"] },
  { id: "IAM-05.1", domain: "Identity and access", question: "Is least privilege enforced?", answer: "Yes", detail: "Role-based access, just-in-time production access and quarterly access reviews.", docIds: ["access-control-policy"] },
  { id: "IAM-14.1", domain: "Identity and access", question: "Is multi-factor authentication required?", answer: "Yes", detail: "MFA for every user; phishing-resistant MFA for administrators.", docIds: ["access-control-policy"] },
  { id: "IPY-01.1", domain: "Interoperability and portability", question: "Can customers export their data in a standard format?", answer: "Yes", detail: "Full export as JSON and CSV, with documents in their original formats.", docIds: ["data-retention-policy"] },
  { id: "IVS-03.1", domain: "Infrastructure security", question: "Is network traffic segmented and monitored?", answer: "Yes", detail: "Separate networks per environment, deny-by-default rules and flow logging.", docIds: ["system-boundary"] },
  { id: "LOG-02.1", domain: "Logging and monitoring", question: "Are audit logs kept and protected from tampering?", answer: "Yes", detail: "Kept for 12 months in write-once storage.", docIds: ["ksi-validation-summary", "conmon-report"] },
  { id: "LOG-05.1", domain: "Logging and monitoring", question: "Are security events monitored and alerted on?", answer: "Yes", detail: "Central monitoring with on-call response around the clock.", docIds: ["conmon-report"] },
  { id: "SEF-02.1", domain: "Incident management", question: "Is there a documented incident response plan?", answer: "Yes", detail: "Tested twice a year with tabletop exercises.", docIds: ["incident-response-plan"] },
  { id: "SEF-08.1", domain: "Incident management", question: "Are customers told about incidents within a set time?", answer: "Yes", detail: "Within 1 hour of confirming an incident that affects federal data.", docIds: ["incident-response-plan"] },
  { id: "STA-09.1", domain: "Supply chain", question: "Are third parties assessed before onboarding and reviewed periodically?", answer: "Yes", detail: "Security review before onboarding and every year after, with 30 days' notice to customers for new subprocessors.", docIds: ["vendor-risk-policy"] },
  { id: "TVM-07.1", domain: "Threat and vulnerability", question: "Are vulnerability scans run at least monthly?", answer: "Yes", detail: "Continuous infrastructure and container scanning; monthly authenticated scans.", docIds: ["vulnerability-scan-summary"] },
  { id: "TVM-10.1", domain: "Threat and vulnerability", question: "Is the service penetration tested by an independent party every year?", answer: "Yes", detail: "Annually and after significant changes. All high findings from 2026 were fixed and retested.", docIds: ["pentest-summary"] },
  { id: "UEM-02.1", domain: "Endpoint management", question: "Are staff devices managed and encrypted?", answer: "Yes", detail: "Managed devices only, with disk encryption, screen lock and automatic updates.", docIds: ["acceptable-use-policy"] },
  { id: "UEM-09.1", domain: "Endpoint management", question: "Can personal devices access production?", answer: "No", detail: "Production is reachable only from managed devices.", docIds: ["access-control-policy"] },
];

const SIG: Seed[] = [
  { domain: "Risk management", question: "Is there a formal risk assessment, repeated at least once a year?", answer: "Yes", detail: "Annual assessment with a risk register reviewed every quarter.", docIds: ["infosec-policy"] },
  { domain: "Security policy", question: "Are security policies approved by management and published to staff?", answer: "Yes", detail: "Approved by the CEO and Head of Security; acknowledged by staff every year.", docIds: ["infosec-policy", "acceptable-use-policy"] },
  { domain: "Organizational security", question: "Is there a named person responsible for information security?", answer: "Yes", detail: "Hannah Cole, Head of Security.", docIds: ["infosec-policy"] },
  { domain: "Asset management", question: "Is an inventory of hardware, software and data kept current?", answer: "Yes", detail: "Updated automatically and reported monthly in continuous monitoring.", docIds: ["conmon-report"] },
  { domain: "Human resources", question: "Do staff sign confidentiality agreements?", answer: "Yes", detail: "At hiring, as part of the employment agreement.", docIds: ["acceptable-use-policy"] },
  { domain: "Physical security", question: "Is physical security of processing facilities covered?", answer: "Yes", detail: "Inherited from the infrastructure provider; Northwind has no datacenters of its own.", docIds: ["customer-responsibility-matrix"] },
  { domain: "IT operations", question: "Are operating procedures documented and changes controlled?", answer: "Yes", detail: "Runbooks for every service; changes go through the pipeline.", docIds: ["change-management-policy"] },
  { domain: "Access control", question: "Are user access rights reviewed on a schedule?", answer: "Yes", detail: "Quarterly for all users and service accounts.", docIds: ["access-control-policy"] },
  { domain: "Access control", question: "Are shared or generic accounts prohibited?", answer: "Yes", detail: "Break-glass accounts only, held in a vault and alerted on use.", docIds: ["access-control-policy"] },
  { domain: "Application security", question: "Is code reviewed before it reaches production?", answer: "Yes", detail: "Two-person review for every change.", docIds: ["sdlc-policy"] },
  { domain: "Application security", question: "Are open-source dependencies scanned for known vulnerabilities?", answer: "Yes", detail: "On every build, with automatic update pull requests.", docIds: ["sdlc-policy"] },
  { domain: "Incident management", question: "Is there an incident response team on call?", answer: "Yes", detail: "Around the clock, with a 15-minute paging target.", docIds: ["incident-response-plan"] },
  { domain: "Business resiliency", question: "Are recovery time and recovery point objectives defined?", answer: "Yes", detail: "RTO 4 hours, RPO 15 minutes.", docIds: ["bcdr-plan"] },
  { domain: "Compliance", question: "Are applicable laws and contractual requirements identified?", answer: "Yes", detail: "FedRAMP 20x, agency contract clauses and state privacy laws are tracked in the compliance register.", docIds: ["independent-assessment-report"] },
  { domain: "Compliance", question: "Is there a current independent attestation report?", answer: "Yes", detail: "SOC 2 Type II for July 2025 to June 2026.", docIds: ["soc2-type2", "soc3"] },
  { domain: "Network security", question: "Is remote administrative access protected?", answer: "Yes", detail: "Through a zero-trust gateway with device checks and phishing-resistant MFA.", docIds: ["access-control-policy"] },
  { domain: "Privacy", question: "Is personal data processed only for documented purposes?", answer: "Yes", detail: "Customer data is used only to provide the service and is never used to train AI models.", docIds: ["data-retention-policy"] },
  { domain: "Privacy", question: "Is personal data transferred outside the United States?", answer: "No", detail: "All processing and storage stays in US regions.", docIds: ["system-boundary"] },
  { domain: "Threat management", question: "Is threat intelligence used in monitoring?", answer: "Yes", detail: "Vendor and government feeds are used in detection rules.", docIds: ["conmon-report"] },
  { domain: "Server security", question: "Are servers built from hardened, approved images?", answer: "Yes", detail: "Immutable images rebuilt weekly and scanned before release.", docIds: ["ksi-validation-summary"] },
  { domain: "Cloud hosting", question: "Is the customer responsibility for cloud controls documented?", answer: "Yes", detail: "In the Customer Responsibility Matrix.", docIds: ["customer-responsibility-matrix"] },
  { domain: "Cloud hosting", question: "Is multi-tenant data logically separated?", answer: "Yes", detail: "Tenant-scoped encryption keys and row-level access checks, tested every year.", docIds: ["pentest-summary", "system-boundary"] },
];

export function seedStandardQuestionnaires(now: number): StandardQuestionnaire[] {
  return [
    {
      id: "caiq",
      name: "CAIQ v4 responses",
      version: "4.0.3",
      updatedAt: new Date(now - 18 * DAY).toISOString(),
      owner: "Hannah Cole",
      items: CAIQ.map((x, i) => ({ ...x, id: x.id ?? `CAIQ-${i + 1}` })),
    },
    {
      id: "sig-lite",
      name: "SIG Lite responses",
      version: "2026",
      updatedAt: new Date(now - 31 * DAY).toISOString(),
      owner: "Luis Ortega",
      items: SIG.map((x, i) => ({ ...x, id: `SL-${String(i + 1).padStart(2, "0")}` })),
    },
  ];
}

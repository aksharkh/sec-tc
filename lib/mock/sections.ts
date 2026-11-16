/* Section index of Northwind's published documents. In the product this is built when a document
   is uploaded (the upload step already reads the text); here it is a fixed sample. Ask this
   trust center quotes from these sections and cites the document and section number. */

export type DocSection = { docId: string; ref: string; heading: string; text: string };

export const SECTIONS: DocSection[] = [
  // Public
  { docId: "infosec-policy", ref: "2.1", heading: "Scope", text: "This policy covers Northwind Workbench, the systems that support it and every employee and contractor with access to them." },
  { docId: "infosec-policy", ref: "4.2", heading: "Encryption", text: "Customer data is encrypted at rest with AES-256 and in transit with TLS 1.2 or higher. Keys are managed under the Encryption and Key Management Standard." },
  { docId: "infosec-policy", ref: "5.1", heading: "Data location", text: "Customer data, including backups, is stored and processed only in US regions (US East and US West)." },
  { docId: "infosec-policy", ref: "6.3", heading: "Personnel", text: "Staff with production access are US persons located in the United States and pass a background check before access is granted." },
  { docId: "infosec-policy", ref: "8.1", heading: "Policy review", text: "This policy is reviewed at least once a year and after any significant change to the service." },
  { docId: "data-retention-policy", ref: "3.2", heading: "End of contract", text: "Agency data is deleted within 30 days of contract end, and deletion is confirmed in writing. Agencies can export all of their data before the end date." },
  { docId: "data-retention-policy", ref: "3.4", heading: "Backups", text: "Backups that contain agency data expire within 35 days and are never restored after deletion is confirmed." },
  { docId: "data-retention-policy", ref: "5.1", heading: "Use of customer data", text: "Customer data is used only to provide the service. It is never used to train AI or machine learning models and is not sent to third-party AI services." },
  { docId: "vendor-risk-policy", ref: "3.1", heading: "Vendor assessment", text: "Each vendor that handles customer data is assessed before onboarding and every year after that, including its security reports and certifications." },
  { docId: "vendor-risk-policy", ref: "4.2", heading: "Subprocessor notice", text: "Agencies get 30 days' notice before Northwind adds a subprocessor that handles customer data." },
  { docId: "acceptable-use-policy", ref: "2.3", heading: "Security testing by customers", text: "Customers may not probe, scan or test the service for vulnerabilities without written permission from Northwind security." },
  { docId: "soc3", ref: "1", heading: "Auditor's opinion", text: "The independent auditor issued an unqualified opinion on controls for security, availability and confidentiality for July 1, 2025 to June 30, 2026." },
  { docId: "vpat", ref: "1.2", heading: "Conformance level", text: "The Workbench web application conforms to WCAG 2.1 Level AA for Section 508, with the exceptions listed in this report." },
  { docId: "iso27001-certificate", ref: "1", heading: "Certified scope", text: "The information security management system for Northwind Workbench is certified to ISO/IEC 27001:2022." },

  // Restricted
  { docId: "encryption-standard", ref: "3.1", heading: "Approved algorithms", text: "Data at rest uses AES-256 through FIPS 140-3 validated modules. Service-to-service traffic inside the boundary uses mutual TLS." },
  { docId: "encryption-standard", ref: "4.2", heading: "Key management and rotation", text: "Keys are held in a managed HSM (Keyline HSM Service) and rotated every 12 months, or at once if a compromise is suspected." },
  { docId: "access-control-policy", ref: "3.1", heading: "Single sign-on", text: "Agency users sign in through SAML 2.0 or OIDC, including PIV and CAC through the agency's identity provider. MFA is enforced for every user." },
  { docId: "access-control-policy", ref: "3.4", heading: "Session timeout", text: "Sessions time out after 15 minutes of inactivity and must be re-authenticated." },
  { docId: "access-control-policy", ref: "4.2", heading: "Privileged access", text: "Production access is just-in-time: each session is approved by a second engineer, limited to 4 hours and recorded. Administrators use phishing-resistant MFA." },
  { docId: "access-control-policy", ref: "5.1", heading: "Access reviews", text: "Access to production and administrative tools is reviewed every quarter, and unused access is removed." },
  { docId: "incident-response-plan", ref: "5.2", heading: "Notifying agencies", text: "Northwind notifies CISA and affected agencies within 1 hour of confirming an incident that affects federal data, and sends updates at least every 24 hours until it is resolved." },
  { docId: "incident-response-plan", ref: "7.1", heading: "Post-incident review", text: "A written post-incident review is sent to affected agencies within 10 business days of resolution." },
  { docId: "bcdr-plan", ref: "2.1", heading: "Recovery objectives", text: "The recovery time objective is 4 hours and the recovery point objective is 15 minutes." },
  { docId: "bcdr-plan", ref: "6.3", heading: "Failover testing", text: "Region failover is tested twice a year. The most recent test restored service in 38 minutes." },
  { docId: "system-boundary", ref: "2.2", heading: "Regions in the boundary", text: "The boundary includes the US East and US West regions only. No component runs outside the United States." },
  { docId: "change-management-policy", ref: "3.1", heading: "Review and deployment", text: "Every change is peer reviewed, tested automatically and deployed from signed builds with a rollback plan." },
  { docId: "change-management-policy", ref: "5.2", heading: "Significant changes", text: "Changes that affect the security boundary are reported to FedRAMP and agencies as significant change notifications before deployment." },
  { docId: "vulnerability-scan-summary", ref: "2", heading: "Scan schedule", text: "Infrastructure and container images are scanned continuously, the web application weekly, and authenticated scans run monthly." },
  { docId: "vulnerability-scan-summary", ref: "4", heading: "Remediation times", text: "Critical findings are fixed within 15 days and high findings within 30 days." },
  { docId: "pentest-summary", ref: "1", heading: "Scope and results", text: "An independent firm tested the application and infrastructure in 2026. All high findings were fixed and retested." },
  { docId: "customer-responsibility-matrix", ref: "AC-3", heading: "IP allowlists", text: "Agency administrators can restrict access to their tenant by IP address, with a separate allowlist for the API." },
  { docId: "customer-responsibility-matrix", ref: "IA-2", heading: "Agency identity provider", text: "Agencies manage the user lifecycle in their own identity provider; Workbench enforces MFA on every sign-in." },
  { docId: "sdlc-policy", ref: "4.1", heading: "Code review", text: "All code is reviewed by a second engineer and scanned for vulnerable dependencies and secrets before it is merged." },
];

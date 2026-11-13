import type { TrustDocument } from "@/lib/types";
import { fakeHash } from "@/lib/utils";
import { PRACTICES } from "./catalog";
import type { TenantProfile } from "./seed";

export const JSON_PATH = "/fedramp/certification-package-overview.json";

/** Documents as they stood at a point in time (versions published on or before `at`). */
export function docsAsOf(docs: TrustDocument[], at: string): TrustDocument[] {
  return docs
    .map((d) => ({ ...d, versions: d.versions.filter((v) => v.publishedAt <= at) }))
    .filter((d) => d.versions.length > 0);
}

/**
 * Builds the Certification Package Overview JSON from the same documents the
 * public page lists, so the page and the file can never disagree.
 */
export function buildPackageJson(opts: {
  profile: TenantProfile;
  docs: TrustDocument[];
  host: string;
  generatedAt: string;
  revision: number;
}) {
  const { profile, docs, host, generatedAt, revision } = opts;
  const base = `https://${host}`;
  const ordered = [...docs].sort((a, b) => order(a.category) - order(b.category) || a.title.localeCompare(b.title));
  const body = {
    $schema: "./schemas/certification-package-overview.schema.json",
    schema_version: "1.0",
    revision,
    generated_at: generatedAt.replace(/\.\d{3}Z$/, "Z"),
    generator: "SecureKnots Trust",
    provider: {
      name: profile.legal,
      uei: profile.uei,
      website: `https://${profile.website}`,
    },
    offering: {
      name: profile.product,
      service_model: "SaaS",
      deployment_model: "Public cloud",
      data_location: "United States",
    },
    certification: {
      program: profile.fedramp.program,
      class: profile.fedramp.cls.replace("Class ", ""),
      status: profile.fedramp.status.toLowerCase(),
      package_id: profile.packageId,
      certified_on: profile.fedramp.certifiedOn.slice(0, 10),
      last_assessment: profile.fedramp.lastAssessment.slice(0, 10),
      next_assessment_due: profile.fedramp.nextAssessment.slice(0, 10),
      assessor: profile.fedramp.assessor,
      continuous_monitoring: {
        cadence: profile.fedramp.conmonCadence.toLowerCase(),
        last_report: profile.fedramp.conmonLast.slice(0, 10),
      },
    },
    trust_center: {
      url: base,
      access_request_url: `${base}/request-access`,
      api_base_url: `${base}/api/v1`,
      access_log_retention_days: 183,
      managed_by: "SecureKnots",
    },
    documents: ordered.map((d) => {
      const v = d.versions[0]!;
      return {
        id: d.id,
        title: d.title,
        category: d.category,
        version: v.version,
        updated: v.publishedAt.slice(0, 10),
        visibility: d.visibility,
        format: d.kind,
        sha256: fakeHash(`${d.id}@${v.version}`),
        practices: d.practices,
        url: `${base}/documents/${d.id}`,
      };
    }),
    key_security_indicators: PRACTICES.map((p) => ({
      id: p.id,
      name: p.name,
      documents: ordered.filter((d) => d.practices.includes(p.id)).map((d) => d.id),
    })),
    contacts: {
      security: profile.contacts[0]!.email,
      vulnerability_disclosure: profile.contacts[1]!.email,
      trust_center_support: profile.contacts[2]!.email,
    },
  };
  return JSON.stringify(body, null, 2);
}

function order(c: TrustDocument["category"]) {
  return c === "package" ? 0 : c === "reports" ? 1 : 2;
}

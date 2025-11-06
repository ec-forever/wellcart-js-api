# Wellcart HIPAA Security Plan

## 1. Data Classification and PHI Handling
- **Data Inventory:** Catalog all data elements ingested by the Wellcart JS API and classify them as Protected Health Information (PHI), personally identifiable information (PII), payment data, or operational metadata.
- **PHI Identification:** Mark fields that meet HIPAA's eighteen identifiers (e.g., names, addresses, medical record numbers). All PHI must be tagged within schemas and API specifications.
- **Handling Requirements:**
  - Limit PHI ingestion to endpoints explicitly designed for clinical data.
  - Enforce request validation that rejects unexpected PHI fields.
  - Mask PHI when logging or displaying in user interfaces; show only minimally necessary data.
  - Redact PHI in support tools; use tokenization for sensitive identifiers where feasible.
- **Data Flow Mapping:**
  1. **Client ingestion:** HTTPS (TLS 1.2+) API endpoints hosted on Vercel capture PHI. Requests pass through Vercel Edge middleware for authentication and input validation.
  2. **Processing layer:** Authenticated requests are routed to serverless functions / API handlers. Business logic applies least-privilege access to downstream services via scoped credentials.
  3. **Storage:** Persistent data stored in HIPAA-eligible databases (e.g., PostgreSQL on AWS RDS with HIPAA compliance) using encrypted connections. Temporary processing data kept in encrypted in-memory stores or short-lived caches.
  4. **Outbound integrations:** Responses returned over TLS. Data shared with external vendors only through approved secure channels after verifying BAAs.
  5. **Analytics/BI:** PHI replicated to secondary systems only after de-identification or aggregation. Usage metrics rely on anonymized data.

## 2. Authentication and Authorization Strategy
- **Authentication:**
  - Implement Vercel Edge Middleware to enforce JSON Web Token (JWT) validation for each request.
  - Support OAuth 2.0 / OpenID Connect flows with a HIPAA-compliant identity provider (e.g., Auth0 HIPAA, Okta).
  - Rotate signing keys regularly and store them in secure secret storage.
- **Authorization:**
  - Use role-based access control (RBAC) with roles mapped to least-privilege scopes (e.g., clinician, patient, admin, support).
  - Enforce attribute-based rules for PHI access, such as organization or patient relationship constraints.
  - Apply principle of least privilege to Vercel project environment variables and deployment tokens; separate staging/production projects with distinct credentials.
- **Session Management:** Short-lived access tokens (≤60 minutes) with refresh tokens stored securely on clients; revoke sessions immediately upon user deactivation.

## 3. Encryption Controls
- **In Transit:** Enforce TLS 1.2+ for all client and service communication. Redirect HTTP to HTTPS at the edge; enable HSTS.
- **At Rest:**
  - Databases and backups must use AES-256 encryption provided by managed services.
  - Encrypt object storage (e.g., AWS S3) with server-side encryption and customer-managed keys (CMKs) where available.
  - Protect local caches with disk encryption or memory-only storage.
- **Key Management:**
  - Store secrets in Vercel Environment Variables for application use; integrate with HashiCorp Vault for centralized key management.
  - Define key rotation policies: rotate encryption keys and JWT signing secrets at least every 90 days, or immediately upon compromise.
  - Restrict key access via RBAC and audit retrieval events.

## 4. Logging and Auditing Plan
- **Capture:** Log request metadata (timestamp, requester ID, endpoint, response code), authentication events, authorization decisions, and error traces without storing PHI.
- **Centralization:** Stream logs to a centralized HIPAA-eligible logging service (e.g., Datadog HIPAA, AWS CloudWatch with KMS encryption) with write-once capabilities.
- **Retention:** Maintain logs for at least six years in compliance with HIPAA, with immutable storage (e.g., S3 Glacier with object lock) and documented retention policies.
- **Monitoring:** Implement alerting for anomalous access patterns, repeated auth failures, or suspicious admin actions.
- **Audit Trails:** Provide auditable access logs for PHI access and configuration changes; ensure timestamps are synchronized via NTP.

## 5. Secure SDLC Checklist
- **Planning:** Perform threat modeling for each new feature or change; document mitigations.
- **Development:**
  - Enforce secure coding guidelines and peer reviews.
  - Run automated linting (ESLint) and static analysis.
  - Integrate dependency scanning (npm audit, Snyk) into CI/CD pipelines.
- **Testing:** Conduct unit/integration tests with anonymized or synthetic data.
- **Pre-Deployment Gates:** Require manual security review sign-off, verify secrets management configuration, and ensure infrastructure as code (IaC) changes pass security checks.
- **Deployment:** Use protected branches and mandatory pull request reviews; include automated CI checks.
- **Post-Deployment:** Monitor for regressions and run retrospective security reviews for incidents.

## 6. Incident Response and Escalation
- **Preparation:** Maintain an incident response (IR) runbook stored securely but accessible to the on-call team.
- **Identification:** Define detection thresholds for security events (e.g., intrusion alerts, data leakage indicators). Train staff to escalate suspicious activity immediately.
- **Containment, Eradication, Recovery:** Follow documented steps for isolating affected services, revoking compromised credentials, and restoring from clean backups.
- **Communication:** Notify compliance officer, legal counsel, and impacted customers within regulatory timeframes. Use pre-approved communication templates.
- **On-Call Rotation:** Establish 24/7 coverage with primary and secondary responders; maintain escalation matrix to security leadership.
- **Exercises:** Conduct semi-annual tabletop exercises and post-mortems to refine procedures.

## 7. Vendor and Subprocessor Management
- **Inventory:** Maintain an up-to-date register of all vendors, subprocessors, and third-party APIs interacting with PHI or supporting the platform.
- **Due Diligence:** Evaluate vendors for HIPAA readiness, security certifications (SOC 2 Type II, ISO 27001), and data protection policies.
- **BAAs:** Obtain executed Business Associate Agreements for all vendors handling PHI; store documents in a centralized compliance repository.
- **Risk Assessments:** Perform initial and annual risk assessments, documenting mitigation plans for identified issues.
- **Monitoring:** Track vendor security incidents and ensure notification obligations are defined in contracts.

## 8. Continuous Compliance Monitoring
- **Assessments:** Schedule annual third-party penetration tests and vulnerability assessments; remediate findings within defined SLAs.
- **Policy Reviews:** Review security and privacy policies at least annually or after major changes.
- **Metrics:** Track key compliance metrics (e.g., patch cadence, incident response times) and report to leadership.
- **Automation:** Use compliance monitoring tools (e.g., Drata, Vanta) to collect evidence, monitor controls, and maintain audit readiness.
- **Training:** Provide mandatory HIPAA and security awareness training annually; track completion.


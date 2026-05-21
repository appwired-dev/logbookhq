import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Pilot Logbook HQ",
  description: "How Pilot Logbook HQ collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-cyan flex items-center justify-center">
            <PlaneIcon />
          </div>
          <div className="font-bold text-slate-900 text-[15px] tracking-tight">
            Pilot Logbook <span className="text-sky-600">HQ</span>
          </div>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link className="text-slate-700 hover:text-slate-900 px-2" href="/pricing">Pricing</Link>
          <Link className="text-slate-700 hover:text-slate-900 px-2" href="/login">Sign in</Link>
          <Link className="btn btn-primary" href="/signup">Start free</Link>
        </nav>
      </header>

      <main className="flex-1 px-6 pb-16">
        <article className="mx-auto max-w-3xl py-10 text-slate-800 leading-relaxed">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mt-2">Last updated: May 18, 2026</p>

          <p className="mt-6">
            <strong>1425652 B.C. LTD.</strong> (&ldquo;<strong>we</strong>&rdquo;, &ldquo;<strong>us</strong>&rdquo;,
            &ldquo;<strong>our</strong>&rdquo;) operates <strong>Pilot Logbook HQ</strong> at{" "}
            <a className="text-sky-700 hover:underline" href="https://pilotlogbookhq.com">https://pilotlogbookhq.com</a>{" "}
            (the &ldquo;<strong>Service</strong>&rdquo;). This Privacy Policy explains what information we collect,
            how we use it, who we share it with, and the choices you have.
          </p>
          <p className="mt-3">
            By using the Service, you agree to this Privacy Policy. If you don&rsquo;t agree, don&rsquo;t use the
            Service. This policy applies alongside our{" "}
            <Link className="text-sky-700 hover:underline" href="/terms">Terms of Service</Link>.
          </p>

          <Section title="1. Information we collect">
            <p>We collect only what we need to run the Service.</p>

            <h3 className="font-bold text-slate-900 mt-4">Account information</h3>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>Email address and password (passwords are stored as one-way hashes via Supabase Auth)</li>
              <li>Optional profile information you choose to add: full name, license number, profile photo (avatar)</li>
              <li>Locale preference (English, Korean, Simplified Chinese, Spanish)</li>
              <li>Primary aviation regime (CA, FAA, EASA, etc.)</li>
            </ul>

            <h3 className="font-bold text-slate-900 mt-4">Content you upload</h3>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>Flight records (dates, aircraft, route, times, roles, conditions, remarks)</li>
              <li>Documents you choose to store in the document vault (medical certificates, licenses, ratings)</li>
              <li>Avatar images</li>
            </ul>

            <h3 className="font-bold text-slate-900 mt-4">Payment information</h3>
            <p>
              We do <strong>not</strong> see, store, or process your credit card details. Payments are handled by
              Stripe, Inc. We store only Stripe customer and subscription identifiers needed to associate your account
              with your billing record (e.g., <code className="text-xs">cus_xxx</code>, subscription status).
            </p>

            <h3 className="font-bold text-slate-900 mt-4">Technical information</h3>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>IP address, browser type, device type (used for security and to prevent abuse)</li>
              <li>Pages visited, referrer, approximate location at country/region level (via Vercel Analytics &mdash; no cookies, no individual user profiles)</li>
              <li>Error and performance data when something fails</li>
            </ul>
          </Section>

          <Section title="2. How we use your information">
            <p>We use your information to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>Provide, maintain, and improve the Service (storing flights, computing currency, generating PDFs)</li>
              <li>Process payments and manage subscriptions through Stripe</li>
              <li>Authenticate you and keep your account secure</li>
              <li>Send transactional emails &mdash; signup confirmation, password resets, payment receipts, important
                account or service notices</li>
              <li>Detect, prevent, and respond to fraud, abuse, or security incidents</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-3">
              <strong>We do not send marketing emails.</strong> The Service does not have a newsletter or promotional
              email list. If we ever add one, it will be strictly opt-in (CASL-compliant).
            </p>
          </Section>

          <Section title="3. Legal basis for processing">
            <p>
              For users in jurisdictions that require a legal basis (e.g., Canada under PIPEDA, the EU under GDPR), we
              process your information based on:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li><strong>Performance of a contract</strong> &mdash; to deliver the Service you signed up for</li>
              <li><strong>Your consent</strong> &mdash; given when you create an account and agree to these terms</li>
              <li><strong>Our legitimate interests</strong> &mdash; security, fraud prevention, service improvement</li>
              <li><strong>Compliance with legal obligations</strong> &mdash; tax records, lawful requests</li>
            </ul>
          </Section>

          <Section title="4. Sub-processors and sharing">
            <p>
              We don&rsquo;t sell your personal information. We share it only with the service providers we need to
              run the Service:
            </p>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="py-2 pr-3 font-bold text-slate-900">Provider</th>
                    <th className="py-2 pr-3 font-bold text-slate-900">Purpose</th>
                    <th className="py-2 font-bold text-slate-900">Location</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  <tr className="border-b border-slate-100">
                    <td className="py-2 pr-3">Supabase, Inc.</td>
                    <td className="py-2 pr-3">Database, authentication, file storage</td>
                    <td className="py-2">United States (us-east-1)</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 pr-3">Stripe, Inc.</td>
                    <td className="py-2 pr-3">Payment processing, billing, customer portal</td>
                    <td className="py-2">United States, global</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 pr-3">Vercel, Inc.</td>
                    <td className="py-2 pr-3">Web hosting, edge delivery, analytics</td>
                    <td className="py-2">Global edge network</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3">Cloudflare, Inc.</td>
                    <td className="py-2 pr-3">Domain DNS</td>
                    <td className="py-2">Global</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              We may also disclose information when required by law (court order, subpoena, lawful regulatory request)
              or when we believe disclosure is necessary to protect our rights, your safety, or the safety of others.
            </p>
            <p className="mt-3">
              If we ever change ownership of the business (sale, merger, acquisition), your information may transfer
              to the new owner subject to this Privacy Policy or a successor policy.
            </p>
          </Section>

          <Section title="5. Cross-border data transfer">
            <p>
              We operate out of British Columbia, Canada, but the Service uses providers with infrastructure outside
              Canada. <strong>Your information may be processed and stored in the United States and other countries</strong>{" "}
              by our sub-processors listed above.
            </p>
            <p className="mt-3">
              When information is transferred outside Canada, it becomes subject to the laws of the destination country,
              including potential government access requests. By using the Service, you consent to this transfer.
            </p>
          </Section>

          <Section title="6. Cookies and similar technologies">
            <p>We use a small number of cookies and similar storage mechanisms:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li><strong>Authentication cookies</strong> (Supabase) &mdash; keep you signed in. Essential.</li>
              <li><strong>Locale preference cookie</strong> (<code className="text-xs">logbookhq.locale</code>) &mdash;
                remembers your chosen language. Essential.</li>
              <li><strong>No third-party advertising cookies.</strong> Vercel Analytics is cookieless.</li>
            </ul>
            <p className="mt-3">
              You can clear cookies in your browser at any time; doing so will sign you out and reset your locale to
              English.
            </p>
          </Section>

          <Section title="7. Data retention">
            <p>We keep your information only as long as needed:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li><strong>Account data and Your Content</strong> &mdash; for the life of your account.</li>
              <li><strong>After account deletion</strong> &mdash; deleted from active systems within 30 days. Encrypted
                backups containing your data are purged on our backup-rotation schedule (up to 90 days).</li>
              <li><strong>Payment and tax records</strong> &mdash; retained as required by Canadian tax law (typically
                six years from the end of the tax year they relate to).</li>
              <li><strong>Security and fraud records</strong> &mdash; retained as long as needed to investigate or
                resolve an incident.</li>
            </ul>
          </Section>

          <Section title="8. Your rights and choices">
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li><strong>Access</strong> your information &mdash; you can see it in your account, and export your
                flight data anytime via Settings (CSV and PDF formats).</li>
              <li><strong>Correct</strong> inaccurate information &mdash; edit it in your account settings.</li>
              <li><strong>Delete</strong> your account and information &mdash; from account settings, or by emailing us.</li>
              <li><strong>Withdraw consent</strong> &mdash; by closing your account. Note that this may end your ability
                to use the Service.</li>
              <li><strong>Complain</strong> to a data protection regulator &mdash; in Canada, the{" "}
                <a className="text-sky-700 hover:underline" href="https://www.priv.gc.ca">Office of the Privacy
                Commissioner of Canada</a>; in the EU/UK, your local data protection authority.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email{" "}
              <a className="text-sky-700 hover:underline" href="mailto:support@pilotlogbookhq.com">
                support@pilotlogbookhq.com
              </a>{" "}
              from the address on your account. We&rsquo;ll respond within 30 days.
            </p>
          </Section>

          <Section title="9. Children">
            <p>
              The Service is not directed at children under 16. We don&rsquo;t knowingly collect information from
              children under 16. If you believe a child has provided us information, email{" "}
              <a className="text-sky-700 hover:underline" href="mailto:support@pilotlogbookhq.com">
                support@pilotlogbookhq.com
              </a>{" "}
              and we&rsquo;ll delete it promptly.
            </p>
          </Section>

          <Section title="10. Security">
            <p>
              We use reasonable administrative, technical, and physical measures to protect your information, including:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>HTTPS / TLS encryption in transit for all traffic</li>
              <li>Encryption at rest at our sub-processors (Supabase, Vercel, Stripe)</li>
              <li>Row-level security policies in the database to ensure you can only access your own data</li>
              <li>Access controls and audit logging on our infrastructure</li>
              <li>Limited employee and contractor access on a need-to-know basis</li>
            </ul>
            <p className="mt-3">
              No system is 100% secure. If we ever detect a breach that affects your information, we&rsquo;ll notify you
              promptly as required by law.
            </p>
          </Section>

          <Section title="11. Public share links (your choice)">
            <p>
              The Service lets you generate a public, read-only share link for your logbook snapshot. <strong>When you
              create a share link, anyone with the URL can view it.</strong> The link contains a long, unguessable token,
              but treat it like a private link &mdash; don&rsquo;t post it publicly unless you intend the data to be
              public.
            </p>
            <p className="mt-3">
              You can revoke any share link at any time from Settings. Once revoked, the URL stops working immediately.
            </p>
          </Section>

          <Section title="12. Changes to this policy">
            <p>
              We may update this Privacy Policy from time to time. When we do, we&rsquo;ll update the &ldquo;Last
              updated&rdquo; date at the top. For material changes, we&rsquo;ll send notice via email or in-app banner
              at least <strong>14 days</strong> before they take effect.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              Questions, requests, or complaints about your privacy? Email us at{" "}
              <a className="text-sky-700 hover:underline" href="mailto:support@pilotlogbookhq.com">
                support@pilotlogbookhq.com
              </a>
              .
            </p>
          </Section>

          <div className="mt-10 pt-6 border-t border-slate-200 text-sm text-slate-500">
            <p>
              <strong>1425652 B.C. LTD.</strong>
              <br />
              operating as Pilot Logbook HQ
              <br />
              Business Number: 703844142BC0001
              <br />
              British Columbia, Canada
            </p>
          </div>
        </article>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-slate-500 border-t border-slate-200/60">
        © Pilot Logbook HQ ·{" "}
        <Link className="hover:text-slate-700" href="/pricing">Pricing</Link> ·{" "}
        <Link className="hover:text-slate-700" href="/terms">Terms</Link> ·{" "}
        <Link className="hover:text-slate-700" href="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
      <div className="mt-3 text-slate-700">{children}</div>
    </section>
  );
}

function PlaneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );
}

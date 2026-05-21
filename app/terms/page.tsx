import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Pilot Logbook HQ",
  description: "Terms governing your use of Pilot Logbook HQ.",
};

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Terms of Service</h1>
          <p className="text-sm text-slate-500 mt-2">Last updated: May 18, 2026</p>

          <p className="mt-6">
            These Terms of Service (&ldquo;<strong>Terms</strong>&rdquo;) form a contract between you and{" "}
            <strong>1425652 B.C. LTD.</strong> (&ldquo;<strong>we</strong>&rdquo;, &ldquo;<strong>us</strong>&rdquo;, or
            &ldquo;<strong>our</strong>&rdquo;), the operator of <strong>Pilot Logbook HQ</strong> at{" "}
            <a className="text-sky-700 hover:underline" href="https://pilotlogbookhq.com">https://pilotlogbookhq.com</a>{" "}
            (the &ldquo;<strong>Service</strong>&rdquo;). By creating an account or using the Service, you agree to these Terms.
            If you don&rsquo;t agree, don&rsquo;t use the Service.
          </p>

          <Section title="1. The Service">
            <p>
              Pilot Logbook HQ is an online tool that helps pilots log flights, track currency under multiple aviation
              authorities (Transport Canada, FAA, EASA, ICAO, and others), export logbook PDFs, and store related
              documents. The Service is provided as software-as-a-service.
            </p>
          </Section>

          <Section title="2. Account & Eligibility">
            <p>
              You must be at least 16 years old and capable of forming a binding contract to use the Service. You&rsquo;re
              responsible for the accuracy of the information in your account and for keeping your password confidential.
              You may not share your account with another person.
            </p>
          </Section>

          <Section title="3. Subscriptions, Billing, and Refunds">
            <p>
              We offer three paid tiers (Pro Monthly at USD $3/month, Pro Annual at USD $30/year, and Lifetime at a
              one-time USD $119) plus a Free tier limited to 100 flights. Current pricing is shown at{" "}
              <Link className="text-sky-700 hover:underline" href="/pricing">/pricing</Link> and may change with
              reasonable notice; existing subscriptions are honored at their original price for at least the current
              billing period.
            </p>
            <p className="mt-3">
              Payments are processed by Stripe, Inc. We don&rsquo;t store your card details. Subscriptions renew
              automatically at the same plan and price until you cancel. You can cancel anytime from your account
              settings (Manage billing &rarr; Cancel).
            </p>
            <p className="mt-3">
              <strong>Refunds.</strong> We offer a <strong>30-day, no-questions-asked refund</strong> on Annual and
              Lifetime purchases. Monthly subscriptions are non-refundable &mdash; just cancel to stop future charges.
              To request a refund, email{" "}
              <a className="text-sky-700 hover:underline" href="mailto:support@pilotlogbookhq.com">
                support@pilotlogbookhq.com
              </a>{" "}
              within 30 days of purchase from the email address on your account.
            </p>
            <p className="mt-3">
              <strong>Failed payments.</strong> If a payment fails, we may suspend access to paid features until the
              account is brought current. Your data remains intact during a suspension.
            </p>
          </Section>

          <Section title="4. Aviation disclaimer (important)">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 my-2">
              <p>
                <strong>Pilot Logbook HQ is a tool, not a regulatory record.</strong> Civil aviation authorities
                (Transport Canada, FAA, EASA, and others) require pilots to maintain logbooks and records that meet
                specific regulatory standards. <strong>You are solely responsible</strong> for ensuring that the records
                you maintain &mdash; whether in our Service or elsewhere &mdash; satisfy the requirements applicable to
                your operations, licenses, and ratings.
              </p>
              <p className="mt-3">
                We provide currency and recency calculations as a convenience based on the rules of the regimes we
                support. <strong>These calculations are estimates only.</strong> Always verify currency status against
                the official regulations of your governing authority before exercising any pilot privilege (carrying
                passengers, flying IFR, acting as PIC, etc.).
              </p>
              <p className="mt-3">
                We are not responsible for any loss of certification, license suspension, enforcement action, missed
                currency, or other consequence arising from reliance on the Service.
              </p>
            </div>
          </Section>

          <Section title="5. Your data and content">
            <p>
              You own the flight records, documents, and other content you upload to the Service (&ldquo;
              <strong>Your Content</strong>&rdquo;). We store and process Your Content only to provide the Service to you.
            </p>
            <p className="mt-3">
              You grant us a limited, non-exclusive license to host, copy, transmit, and display Your Content as
              necessary to operate the Service for you. We do not sell or share Your Content with third parties for
              advertising or marketing purposes.
            </p>
            <p className="mt-3">
              <strong>Data export.</strong> You may export your flight data at any time from your account settings
              (CSV and PDF formats are supported).
            </p>
            <p className="mt-3">
              <strong>Account deletion.</strong> You may delete your account at any time. On deletion, we remove Your
              Content from our active systems within 30 days. Encrypted backups containing Your Content are purged on
              our normal backup-rotation schedule (up to 90 days). We may retain anonymized aggregate data and records
              required by law (e.g., payment records).
            </p>
          </Section>

          <Section title="6. Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>Use the Service for any unlawful purpose or in violation of any law or regulation</li>
              <li>Attempt to gain unauthorized access to any system, account, or data</li>
              <li>Reverse-engineer, decompile, or attempt to extract the source code of the Service</li>
              <li>Resell, sublicense, or redistribute the Service to third parties without our written permission</li>
              <li>Use the Service to harass, defraud, impersonate, or otherwise harm others</li>
              <li>Upload content that infringes another person&rsquo;s intellectual property or privacy rights</li>
              <li>Probe, scan, or test the vulnerability of the Service except as part of a coordinated disclosure</li>
              <li>Use automated means to scrape, crawl, or extract data beyond what the Service&rsquo;s normal use permits</li>
            </ul>
            <p className="mt-3">
              We may suspend or terminate accounts that violate these rules, with or without prior notice depending on
              severity.
            </p>
          </Section>

          <Section title="7. Service availability">
            <p>
              We strive to keep the Service available, but we don&rsquo;t guarantee uninterrupted access. We may modify,
              suspend, or discontinue features with reasonable notice. We may perform scheduled maintenance that briefly
              interrupts the Service. We don&rsquo;t commit to any specific uptime SLA on Free, Pro Monthly, Pro Annual,
              or Lifetime tiers.
            </p>
          </Section>

          <Section title="8. Termination">
            <p>
              You may terminate your account at any time from account settings. We may terminate or suspend your account
              for material breach of these Terms, fraudulent activity, abuse of the Service, extended inactivity
              (12+ months on a Free account), or if we discontinue the Service.
            </p>
            <p className="mt-3">
              On termination, you lose access to the Service and Your Content stored within it. Export your data before
              terminating if you want to keep it. If we terminate your paid subscription for reasons other than your
              breach, we&rsquo;ll refund any unused portion of the current billing period on a pro-rata basis.
            </p>
          </Section>

          <Section title="9. Our intellectual property">
            <p>
              The Service &mdash; including the software, design, layouts, code, branding, name, and documentation
              &mdash; is owned by us and protected by copyright, trademark, and other intellectual property laws. These
              Terms don&rsquo;t grant you any rights to our intellectual property except the limited, non-transferable
              right to use the Service as intended.
            </p>
          </Section>

          <Section title="10. Disclaimers">
            <p>
              The Service is provided <strong>&ldquo;as is&rdquo; and &ldquo;as available,&rdquo;</strong> without
              warranties of any kind, express or implied. To the maximum extent permitted by law, we disclaim all
              warranties including merchantability, fitness for a particular purpose, accuracy, and non-infringement.
            </p>
            <p className="mt-3">
              We don&rsquo;t warrant that the Service will be error-free, uninterrupted, secure, or meet your specific
              requirements. You use the Service at your own risk.
            </p>
          </Section>

          <Section title="11. Limitation of liability">
            <p>
              To the maximum extent permitted by law, <strong>our total liability</strong> to you for any claim arising
              out of or related to the Service is limited to the <strong>greater of</strong>:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>The amount you paid us in the twelve (12) months before the claim arose, or</li>
              <li>One hundred Canadian dollars (CAD $100).</li>
            </ul>
            <p className="mt-3">
              We are <strong>not liable</strong> for indirect, incidental, special, consequential, exemplary, or
              punitive damages, including but not limited to lost profits, lost data, loss of certification, loss of
              business opportunity, or loss of goodwill &mdash; even if we&rsquo;ve been advised of the possibility.
            </p>
            <p className="mt-3">
              This limitation applies regardless of the legal theory (contract, tort, statute, or otherwise) and
              survives termination of these Terms.
            </p>
          </Section>

          <Section title="12. Indemnification">
            <p>
              You agree to indemnify, defend, and hold harmless us and our directors, officers, and employees from any
              third-party claims, damages, or expenses (including reasonable legal fees) arising from: (a) your misuse
              of the Service, (b) your violation of these Terms, (c) your violation of any law, or (d) your infringement
              of any third party&rsquo;s rights.
            </p>
          </Section>

          <Section title="13. Changes to these Terms">
            <p>
              We may update these Terms from time to time. When we do, we&rsquo;ll update the &ldquo;Last updated&rdquo;
              date at the top. For <strong>material</strong> changes (anything that meaningfully reduces your rights or
              changes how we handle your data), we&rsquo;ll send notice via email or in-app banner at least{" "}
              <strong>14 days</strong> before they take effect. Continued use of the Service after the effective date
              constitutes acceptance.
            </p>
          </Section>

          <Section title="14. Governing law and disputes">
            <p>
              These Terms are governed by the laws of the <strong>Province of British Columbia, Canada</strong>, and
              the federal laws of Canada applicable therein, without regard to conflict-of-law principles. You agree
              that any dispute arising out of or relating to these Terms or the Service will be resolved exclusively in
              the courts of British Columbia, and you consent to the personal jurisdiction of those courts.
            </p>
          </Section>

          <Section title="15. General">
            <p>
              <strong>Entire agreement.</strong> These Terms (together with our Privacy Policy) are the entire agreement
              between you and us regarding the Service and supersede any prior agreements.
            </p>
            <p className="mt-3">
              <strong>Severability.</strong> If any provision of these Terms is held unenforceable, the remaining
              provisions remain in full force.
            </p>
            <p className="mt-3">
              <strong>No waiver.</strong> Our failure to enforce any right doesn&rsquo;t waive that right.
            </p>
            <p className="mt-3">
              <strong>Assignment.</strong> You may not assign or transfer these Terms without our written consent. We
              may assign these Terms in connection with a merger, acquisition, or sale of assets.
            </p>
            <p className="mt-3">
              <strong>Force majeure.</strong> We are not liable for delays or failures caused by events outside our
              reasonable control (natural disasters, war, cyberattacks, government action, internet outages, etc.).
            </p>
          </Section>

          <Section title="16. Contact">
            <p>
              Questions about these Terms? Email us at{" "}
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

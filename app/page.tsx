import { FlagDemo } from "./_landing/FlagDemo";
import { TapedSentence } from "./_landing/TapedSentence";
import { flags } from "./_landing/sample-agreement";
import styles from "./_landing/landing.module.css";

const APP_ENTRY = "/app";

export default function Home() {
  const lead = flags[0];

  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <a href="/" className={styles.wordmark}>
          Redline
          <span className={styles.wordmarkFlag} aria-hidden="true" />
        </a>
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="hero-heading">
          <div className={styles.pitch}>
            <h1 id="hero-heading" className={styles.headline}>
              Before you sign, see which sentences could cost you.
            </h1>
            <p className={styles.lede}>Every flag quotes its exact sentence.</p>
            <a className={styles.cta} href={APP_ENTRY}>
              Try it on a document
            </a>
            <p className={styles.fineprint}>
              PDF, Word or plain text. Scans and photos of paper won&rsquo;t work.
            </p>
          </div>
          <FlagDemo />
        </section>

        <section className={styles.proof} aria-labelledby="proof-heading">
          <figure className={styles.strip}>
            <blockquote className={styles.stripQuote}>
              <TapedSentence>{lead.sentence}</TapedSentence>
            </blockquote>
            <figcaption className={styles.stripCaption}>
              Section {lead.clause} of the sample agreement
            </figcaption>
          </figure>
          <div className={styles.proofText}>
            <h2 id="proof-heading" className={styles.sectionHeading}>
              Every flag shows its sentence
            </h2>
            <p>
              That&rsquo;s flag 1, copied exactly as it appears in section {lead.clause} of the
              sample. Search your own copy for any sentence Redline quotes and you&rsquo;ll find it
              there. If Redline can&rsquo;t point to a sentence, it doesn&rsquo;t raise the flag.
            </p>
          </div>
        </section>

        <section className={styles.limits} aria-labelledby="limits-heading">
          <h2 id="limits-heading" className={styles.sectionHeading}>
            What Redline won&rsquo;t do
          </h2>
          <ul className={styles.slip}>
            <li>
              It won&rsquo;t tell you whether to sign. That depends on things the agreement
              doesn&rsquo;t say, like how much you need the work.
            </li>
            <li>
              Nothing here is legal advice. Redline explains what the agreement says; what to do
              about it is your call, or a lawyer&rsquo;s.
            </li>
            <li>
              Scans and photos of paper won&rsquo;t work. Redline needs a PDF, Word or text file with
              real text in it, so every quote matches the page.
            </li>
            <li>
              Leases and terms of service are outside what it checks. It&rsquo;s built for freelance
              and client service agreements.
            </li>
          </ul>
        </section>

        <section className={styles.close} aria-labelledby="close-heading">
          <h2 id="close-heading" className={styles.closeHeading}>
            Got an agreement waiting on your signature?
          </h2>
          <a className={styles.cta} href={APP_ENTRY}>
            Try it on a document
          </a>
        </section>
      </main>

      <footer className={styles.footer}>
        <span className={styles.footerMark}>Redline</span>
        <p>Redline explains what a document says. It isn&rsquo;t legal advice.</p>
        <p>The agreement on this page is a sample written for it.</p>
      </footer>
    </div>
  );
}

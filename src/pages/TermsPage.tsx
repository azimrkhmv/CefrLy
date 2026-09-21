import { Link } from 'react-router-dom'
import { LegalSection, LegalShell } from '../components/LegalShell'
import { ADMIN_URL } from '../components/Layout'

// The terms a student agrees to on sign-up. Written against how Cefrly actually
// works (phone-only accounts through @CefrLy_bot, manual plan activation after a
// card transfer, AI-marked Writing and Speaking). If one of those changes,
// change the matching section here and bump UPDATED.
const UPDATED = '21 September 2026'

export function TermsPage() {
  return (
    <LegalShell
      title="Terms of Use"
      updated={UPDATED}
      intro={
        <p>
          These terms cover your use of Cefrly, a practice and mock-exam platform for the CEFR
          (multilevel) English exam. By creating an account or using Cefrly you agree to them. If
          you do not agree, please do not use the service.
        </p>
      }
    >
      <LegalSection n={1} title="What Cefrly is — and is not">
        <p>
          Cefrly offers practice tests, full mock papers, model answers and feedback for Reading,
          Listening, Writing and Speaking.
        </p>
        <p>
          <strong>Every band and score on Cefrly is an estimate.</strong> Cefrly is not affiliated
          with any official examination body. Our results are not a certificate and cannot be used
          as proof of your level. Your result in the real exam may differ.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Your account">
        <ul>
          <li>
            You sign up with an Uzbek (+998) phone number, confirmed through our Telegram bot
            @CefrLy_bot. The number must be your own.
          </li>
          <li>One account per person. Do not share your login or let someone else take tests for you.</li>
          <li>
            Keep your password safe. You are responsible for what happens under your account until
            you tell us it has been compromised.
          </li>
          <li>
            If you are under 18, use Cefrly with the permission of a parent or guardian.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={3} title="Plans and payment">
        <ul>
          <li>
            Free tests are open to every signed-in account at no cost. Premium tests need a paid
            plan (Pro or Premium), priced in so'm per month as shown on the{' '}
            <Link to="/pricing" className="font-bold text-brand hover:underline">
              Pricing
            </Link>{' '}
            page.
          </li>
          <li>
            You pay by bank-card transfer and send the receipt to our Telegram account. We activate
            the plan by hand once the payment is confirmed, normally within one working day. The
            plan runs until the expiry date shown in your Settings.
          </li>
          <li>
            Plans do not renew automatically. Nothing is charged without you sending a new
            payment.
          </li>
          <li>
            Pro includes a monthly number of premium mocks and Writing/Speaking checks. Unused
            allowance does not carry over.
          </li>
          <li>
            If a plan was paid for but could not be activated, or a fault on our side stopped you
            using it, message us and we will extend the plan or refund the payment.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={4} title="AI marking">
        <p>
          Writing and Speaking answers are marked by AI models against the published CEFR
          (multilevel) assessment criteria. The marks can be wrong. If you think a mark is wrong,
          use “Ask for a recheck” on a Speaking result, or message us, and we will look at it.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Fair use">
        <p>You agree not to:</p>
        <ul>
          <li>copy, download, resell or publish Cefrly's test papers, recordings, answer keys or model answers;</li>
          <li>try to get answer keys before submitting, get round the listening play limit, or get round plan limits;</li>
          <li>use bots or scripts against the service, or try to break or overload it;</li>
          <li>upload anything unlawful, offensive, or that is not your own work.</li>
        </ul>
        <p>We may suspend or close an account that breaks these rules.</p>
      </LegalSection>

      <LegalSection n={6} title="Content and ownership">
        <p>
          The test papers, recordings, model answers, design and software are owned by Cefrly or
          its licensors. You may use them only for your own study.
        </p>
        <p>
          Your answers, essays and recordings stay yours. You let us store and process them to mark
          them, show you your results and improve the service, as described in the{' '}
          <Link to="/privacy" className="font-bold text-brand hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection n={7} title="Availability">
        <p>
          We work to keep Cefrly running, but we cannot promise it will always be available or free
          of errors. We may change, add or remove features and tests. If a test is interrupted by a
          fault on our side, contact us.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Liability">
        <p>
          Cefrly is a study tool. To the extent the law allows, we are not responsible for exam
          results, decisions made on the basis of our estimated bands, or indirect losses. Nothing
          in these terms limits rights you have under the law of the Republic of Uzbekistan.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Closing your account">
        <p>
          You can ask us to delete your account at any time by messaging us on Telegram. We may
          close an account that breaks these terms.
        </p>
      </LegalSection>

      <LegalSection n={10} title="Changes and contact">
        <p>
          We may update these terms. If a change is significant, we will tell you in the app or
          through @CefrLy_bot before it takes effect. Questions?{' '}
          <a href={ADMIN_URL} target="_blank" rel="noopener noreferrer" className="font-bold text-brand hover:underline">
            Message us on Telegram
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  )
}

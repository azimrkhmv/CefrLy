import { Link } from 'react-router-dom'
import { LegalSection, LegalShell } from '../components/LegalShell'
import { ADMIN_URL } from '../components/Layout'

// What Cefrly collects and who processes it, written from the code, not from a
// template. KEEP IT TRUE: a new data field, a new AI vendor, a change to how
// long speaking audio is kept, or a new tracker all need an edit here and a new
// UPDATED date. Vendors as of this date: Supabase (Tokyo region), Vercel,
// Google Gemini, OpenRouter (backup marking), Telegram.
const UPDATED = '21 September 2026'

export function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      updated={UPDATED}
      intro={
        <p>
          This policy explains what personal data Cefrly collects, why, who processes it, and what
          you can ask us to do with it. We collect only what the service needs. We do not sell your
          data and we do not show ads.
        </p>
      }
    >
      <LegalSection n={1} title="What we collect">
        <ul>
          <li>
            <strong>Account:</strong> your first name, surname, father's name, +998 phone number and
            password. The password is stored only as a hash — nobody at Cefrly can read it.
          </li>
          <li>
            <strong>Telegram:</strong> your Telegram user ID and the phone number you share with
            @CefrLy_bot, used to confirm your number and send sign-in and password codes.
          </li>
          <li>
            <strong>Study profile:</strong> the answers you give when you first sign in — exam
            experience, current and target level, exam timeframe, weak areas, daily study time and
            how you heard about us.
          </li>
          <li>
            <strong>Tests:</strong> your answers, scores, bands, the essays you write, and for
            Speaking, your recordings and their transcripts.
          </li>
          <li>
            <strong>Plan:</strong> which plan you have and when it expires. Card payments go
            directly between banks — we see only the receipt you send us.
          </li>
          <li>
            <strong>Technical:</strong> sign-in session tokens, and IP addresses used briefly to
            limit abuse of sign-up. Your browser also stores your unfinished answers and volume
            setting so a refresh does not lose them.
          </li>
        </ul>
        <p>We use no advertising or third-party analytics trackers.</p>
      </LegalSection>

      <LegalSection n={2} title="Why we use it">
        <ul>
          <li>to create your account and let you sign in;</li>
          <li>to run tests, mark them and show you your results and progress;</li>
          <li>to give you the plan you paid for and apply its limits;</li>
          <li>to answer support requests and challenged marks;</li>
          <li>to keep the service secure and fix problems.</li>
        </ul>
      </LegalSection>

      <LegalSection n={3} title="Who processes it">
        <p>We use these services to run Cefrly. Each gets only what its job needs.</p>
        <ul>
          <li>
            <strong>Supabase</strong> — database, sign-in and file storage. Servers in Tokyo,
            Japan.
          </li>
          <li>
            <strong>Vercel</strong> — serves the website.
          </li>
          <li>
            <strong>Google (Gemini)</strong> — AI marking of Writing and Speaking. It receives your
            essay or recording and the task, not your name or phone number.
          </li>
          <li>
            <strong>OpenRouter</strong> — backup AI marking when Google is unavailable. It may pass
            the essay or recording to OpenAI, Google or Anthropic models.
          </li>
          <li>
            <strong>Telegram</strong> — our bot, @CefrLy_bot, and support messages you send us.
          </li>
        </ul>
        <p>
          Your data is therefore processed outside Uzbekistan. By using Cefrly you agree to this
          transfer.
        </p>
      </LegalSection>

      <LegalSection n={4} title="How long we keep it">
        <ul>
          <li>
            <strong>Speaking recordings</strong> are deleted as soon as they are marked. If marking
            fails, they are kept for up to 3 hours so you can retry, then deleted. The transcript
            and the mark are kept with your results.
          </li>
          <li>
            <strong>Everything else</strong> is kept while your account exists, so your progress
            history stays available.
          </li>
          <li>
            When you delete your account, your profile and test history are deleted with it.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={5} title="Your rights">
        <p>You can ask us to:</p>
        <ul>
          <li>tell you what data we hold about you, and give you a copy;</li>
          <li>correct it — you can change your name yourself in Settings;</li>
          <li>delete your account and its data.</li>
        </ul>
        <p>
          Send the request from Telegram with the phone number of your account, and we will act on
          it within 30 days.
        </p>
      </LegalSection>

      <LegalSection n={6} title="Security">
        <p>
          Data travels over encrypted connections. Answer keys and other accounts' data are
          protected by server-side access rules, and only a small number of staff accounts can see
          student records, only to run the service.
        </p>
      </LegalSection>

      <LegalSection n={7} title="Children">
        <p>
          Cefrly is meant for exam candidates. If you are under 18, use it with the permission of a
          parent or guardian, who can contact us about your data.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Changes and contact">
        <p>
          If we change this policy in a significant way, we will tell you in the app or through
          @CefrLy_bot. See also our{' '}
          <Link to="/terms" className="font-bold text-brand hover:underline">
            Terms of Use
          </Link>
          . Questions or requests?{' '}
          <a href={ADMIN_URL} target="_blank" rel="noopener noreferrer" className="font-bold text-brand hover:underline">
            Message us on Telegram
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  )
}

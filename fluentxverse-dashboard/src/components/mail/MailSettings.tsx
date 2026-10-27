import { useState } from 'preact/hooks';
import { mailApi, type MailAccount, type MailPreferences } from '../../api/mail.api';
import { MailDialog, MailIcon } from './MailUi';
export default function MailSettings({ accounts, preferences, onSaved, onClose }: { accounts: MailAccount[]; preferences: MailPreferences; onSaved: (value: MailPreferences) => void; onClose: () => void }) {
  const [value, setValue] = useState(preferences), [name, setName] = useState(''), [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [verified, setVerified] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try { await mailApi.savePreferences(value); onSaved(value); onClose(); } catch (error: any) { setError(error.message); } finally { setBusy(false); }
  };
  const test = async (account: MailAccount) => {
    setBusy(true); setError(''); setVerified('');
    try { await mailApi.verify(account.id); setVerified(`${account.address}: IMAP and SMTP connected.`); } catch (error: any) { setError(error.message); } finally { setBusy(false); }
  };
  return <MailDialog title="Email settings" onClose={onClose} busy={busy}><div className="mail-settings-body">
    <section><h3>Mailboxes</h3>{accounts.length ? accounts.map(account => <div className="mail-account-setting" key={account.id}><MailIcon name="mail-settings-line"/><div><strong>{account.label}</strong><small>{account.address}</small></div><button type="button" disabled={busy} onClick={() => void test(account)}>Test connection</button></div>) : <p>No mailbox is configured on the server.</p>}
      <span className="mail-privacy-label"><MailIcon name="shield-keyhole-line"/>Credentials managed on the server</span></section>
    <section><h3>Signature</h3><label htmlFor="mail-signature">Your outgoing signature</label><textarea id="mail-signature" rows={4} maxLength={3000} value={value.signature} onInput={event => setValue({ ...value, signature: event.currentTarget.value })}/></section>
    <section><h3>Contacts <span>{value.contacts.length}/250</span></h3>
      <form className="mail-contact-form" onSubmit={event => { event.preventDefault(); setError(''); if (value.contacts.length >= 250) { setError('Contact limit reached.'); return; } setValue({ ...value, contacts: [...value.contacts.filter(contact => contact.email.toLowerCase() !== email.toLowerCase()), { name: name.trim(), email: email.trim() }] }); setName(''); setEmail(''); }}>
        <input aria-label="Contact name" placeholder="Name" maxLength={100} required value={name} onInput={event => setName(event.currentTarget.value)}/><input aria-label="Contact email" placeholder="Email address" type="email" maxLength={254} required value={email} onInput={event => setEmail(event.currentTarget.value)}/><button type="submit" title="Add contact" aria-label="Add contact"><MailIcon name="add-line"/></button>
      </form>
      <ul className="mail-contacts">{value.contacts.map(contact => <li key={contact.email}><div><strong>{contact.name}</strong><small>{contact.email}</small></div><button type="button" title={`Remove ${contact.email}`} aria-label={`Remove ${contact.email}`} onClick={() => setValue({ ...value, contacts: value.contacts.filter(item => item.email !== contact.email) })}><MailIcon name="delete-bin-line"/></button></li>)}</ul>
    </section>
    {verified && <p className="mail-success" role="status">{verified}</p>}{error && <p className="mail-error" role="alert">{error}</p>}
    </div><footer><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="mail-primary" onClick={() => void save()} disabled={busy}>{busy ? 'Working...' : 'Save settings'}</button></footer>
  </MailDialog>;
}

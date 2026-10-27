import type { MailAction, MailFolder, MailMessage, MailPage, MailSummary } from '../../../../shared/mail';

export interface MailListView { accountId: string; folder: string; page: number; search: string; filter: string }
type Flags = Pick<MailSummary, 'seen' | 'starred'>;
const matches = (message: MailSummary, filter: string) => filter === 'unread' ? !message.seen : filter === 'starred' ? message.starred : true;
export const mailViewKey = (view: MailListView) => JSON.stringify([view.accountId, view.folder, view.page, view.search, view.filter]);
export const mailMessageKey = (accountId: string, folder: string, validity: string, uid: number) => JSON.stringify([accountId, folder, validity, uid]);
export const movesMessage = (action: MailAction) => ['archive', 'trash', 'spam', 'move'].includes(action);
export const actionFlags = (action: MailAction): Partial<Flags> => action === 'read' || action === 'unread' ? { seen: action === 'read' } : action === 'star' || action === 'unstar' ? { starred: action === 'star' } : {};

export function updateMailPage(data: MailPage, action: MailAction, ids: number[], filter: string, known: MailSummary[]): MailPage {
  const targets = new Set(ids), moving = movesMessage(action), patch = actionFlags(action);
  const affected = known.filter(message => targets.has(message.uid));
  const delta = affected.reduce((total, message) => total + Number(!moving && matches({ ...message, ...patch }, filter)) - Number(matches(message, filter)), 0);
  const total = Math.max(0, data.total + delta);
  return { ...data, total, pages: Math.max(1, Math.ceil(total / 25)), messages: data.messages.flatMap(message => {
    if (!targets.has(message.uid)) return [message];
    const next = { ...message, ...patch };
    return moving || !matches(next, filter) ? [] : [next];
  }) };
}

export function updateMailFolders(folders: MailFolder[], source: string, destination: string | undefined, action: MailAction, affected: MailSummary[]): MailFolder[] {
  const moving = movesMessage(action), unread = affected.filter(message => !message.seen).length;
  const readDelta = action === 'read' ? -unread : action === 'unread' ? affected.length - unread : 0;
  return folders.map(folder => {
    const totalDelta = moving ? folder.path === source ? -affected.length : folder.path === destination ? affected.length : 0 : 0;
    const unreadDelta = folder.path === source ? moving ? -unread : readDelta : moving && folder.path === destination ? unread : 0;
    const total = Math.max(0, folder.total + totalDelta);
    return totalDelta || unreadDelta ? { ...folder, total, unread: Math.max(0, Math.min(total, folder.unread + unreadDelta)) } : folder;
  });
}

// Component-local only: never persist private mail in browser storage or share it across operators.
export class MailViewCache {
  private pages = new Map<string, { view: MailListView; value: MailPage; at: number }>();
  private messages = new Map<string, { value: MailMessage; at: number }>();
  private flags = new Map<string, { value: Partial<Flags>; at: number }>();
  constructor(private now = () => Date.now()) {}
  page(view: MailListView) {
    const key = mailViewKey(view), entry = this.pages.get(key);
    if (!entry || this.now() - entry.at > 60_000) { this.pages.delete(key); return undefined; }
    return entry.value;
  }
  storePage(view: MailListView, value: MailPage) {
    const key = mailViewKey(view);
    this.pages.delete(key); this.pages.set(key, { view, value, at: this.now() });
    if (this.pages.size > 12) this.pages.delete(this.pages.keys().next().value!);
  }
  reconcilePage(view: MailListView, value: MailPage): MailPage {
    const messages = value.messages.map(message => ({ ...message, ...this.currentFlags(mailMessageKey(view.accountId, view.folder, value.uidValidity, message.uid)) }));
    const delta = messages.reduce((total, message, index) => total + Number(matches(message, view.filter)) - Number(matches(value.messages[index]!, view.filter)), 0);
    const total = Math.max(0, value.total + delta);
    return { ...value, total, pages: Math.max(1, Math.ceil(total / 25)), messages: messages.filter(message => matches(message, view.filter)) };
  }
  invalidateFolder(accountId: string, folder: string) {
    for (const [key, entry] of this.pages) if (entry.view.accountId === accountId && entry.view.folder === folder) this.pages.delete(key);
  }
  message(key: string) {
    const entry = this.messages.get(key);
    if (!entry || this.now() - entry.at > 300_000) { this.messages.delete(key); return undefined; }
    return { ...entry.value, ...this.currentFlags(key) };
  }
  storeMessage(key: string, value: MailMessage) {
    const next = { ...value, ...this.currentFlags(key) };
    this.messages.delete(key); this.messages.set(key, { value: next, at: this.now() });
    // Bound both the number and approximate body size of cached messages.
    let size = [...this.messages.values()].reduce((total, entry) => total + entry.value.text.length + (entry.value.html?.length || 0), 0);
    while (this.messages.size > 20 || size > 2_500_000) {
      const oldest = this.messages.keys().next().value;
      if (!oldest) break;
      const removed = this.messages.get(oldest)!;
      size -= removed.value.text.length + (removed.value.html?.length || 0); this.messages.delete(oldest);
    }
    return next;
  }
  patch(key: string, action: MailAction) {
    const patch = actionFlags(action), entry = this.messages.get(key);
    if (entry) entry.value = { ...entry.value, ...patch };
    this.flags.set(key, { value: { ...this.currentFlags(key), ...patch }, at: this.now() });
    if (this.flags.size > 100) this.flags.delete(this.flags.keys().next().value!);
  }
  private currentFlags(key: string) {
    const entry = this.flags.get(key);
    return entry && this.now() - entry.at <= 60_000 ? entry.value : {};
  }
  clear() { this.pages.clear(); this.messages.clear(); this.flags.clear(); }
}

import { apiClient } from './apiClient';
import type { MailAction, MailDraft, MailFolder, MailMessage, MailPage, MailPreferences, MailSendResult, MailStatus } from '../../../shared/mail';
export type { MailAccount, MailAddress, MailAttachment, MailDraft, MailFile, MailFolder, MailMessage, MailPage, MailPreferences, MailSendResult, MailStatus, MailSummary } from '../../../shared/mail';

async function call<T>(method: string, path: string, data?: unknown, signal?: AbortSignal): Promise<T> {
  try {
    const response = await apiClient.request({ method, url: `/admin/mail${path}`, data, signal });
    if (!response.data.success) throw new Error(response.data.error || 'Email request failed.');
    return response.data.data;
  } catch (error: any) { if (signal?.aborted) throw error; throw new Error(error.response?.data?.error || error.message || 'Email is unavailable. Please try again.'); }
}
const box = (id: string) => `/${encodeURIComponent(id)}`;
export const mailApi = {
  status: (signal?: AbortSignal) => call<MailStatus>('GET', '/status', undefined, signal),
  preferences: () => call<MailPreferences>('GET', '/preferences'),
  savePreferences: (data: MailPreferences) => call<void>('PUT', '/preferences', data),
  folders: (id: string, signal?: AbortSignal) => call<MailFolder[]>('GET', `${box(id)}/folders`, undefined, signal),
  createFolder: (id: string, name: string) => call<void>('POST', `${box(id)}/folders`, { name }),
  verify: (id: string) => call<void>('POST', `${box(id)}/verify`, {}),
  list: (id: string, folder: string, page: number, search: string, filter: string, signal?: AbortSignal) => call<MailPage>('GET', `${box(id)}/messages?${new URLSearchParams({ folder, page: String(page), search, filter })}`, undefined, signal),
  message: (id: string, folder: string, uid: number, uidValidity: string, signal?: AbortSignal) => call<MailMessage>('GET', `${box(id)}/messages/${uid}?${new URLSearchParams({ folder, uidValidity })}`, undefined, signal),
  action: (id: string, folder: string, uidValidity: string, uids: number[], action: MailAction, destination?: string) => call<void>('POST', `${box(id)}/actions`, { folder, uidValidity, uids, action, destination }),
  drafts: (id: string, signal?: AbortSignal) => call<MailDraft[]>('GET', `${box(id)}/drafts`, undefined, signal),
  saveDraft: (draft: MailDraft) => { const { updatedAt, ...data } = draft; return call<MailDraft>('PUT', `${box(draft.accountId)}/drafts`, data); },
  deleteDraft: (id: string, draftId: string) => call<void>('DELETE', `${box(id)}/drafts/${encodeURIComponent(draftId)}`),
  send: (draft: MailDraft, requestId: string) => call<MailSendResult>('POST', `${box(draft.accountId)}/send`, { draftId: draft.id, revision: draft.revision, requestId }),
  async attachmentFile(id: string, folder: string, uid: number, uidValidity: string, index: number, name: string, type: string) {
    const response = await apiClient.get(`/admin/mail${box(id)}/messages/${uid}/attachments/${index}`, { params: { folder, uidValidity }, responseType: 'blob' });
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] || ''); reader.onerror = () => reject(new Error('Attachment could not be read.')); reader.readAsDataURL(response.data); });
    return { name, type, data };
  },
  async attachment(id: string, folder: string, uid: number, uidValidity: string, index: number, name: string) {
    const response = await apiClient.get(`/admin/mail${box(id)}/messages/${uid}/attachments/${index}`, { params: { folder, uidValidity }, responseType: 'blob' });
    const url = URL.createObjectURL(response.data), anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  },
};

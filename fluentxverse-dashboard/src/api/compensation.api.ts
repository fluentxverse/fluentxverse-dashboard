import { operations } from './operations.api';
import type { TutorCompensation, TutorCompensationDetail, TutorRateChange, TutorRateUpdate } from '../../../fluentxverse-server/src/shared/tutorCompensation';

export const compensationApi = {
  summaries: (ids: string[]): Promise<TutorCompensation[]> => operations(`/compensation?tutorIds=${encodeURIComponent(ids.join(','))}`),
  detail: (id: string, beforeVersion?: number): Promise<TutorCompensationDetail> => operations(`/compensation/${encodeURIComponent(id)}${beforeVersion === undefined ? '' : `?beforeVersion=${beforeVersion}`}`),
  save: (id: string, input: TutorRateUpdate): Promise<{ change: TutorRateChange; replayed: boolean }> => operations(`/compensation/${encodeURIComponent(id)}`, 'put', input),
};

export const usdRateLabel = (cents: number | null) => cents === null ? 'Not set' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

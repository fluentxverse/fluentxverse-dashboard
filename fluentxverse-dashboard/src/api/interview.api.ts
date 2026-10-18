import { apiClient } from './apiClient';

const api = apiClient;

const asArray = <T,>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : [];

const emptyInterviewStats = {
  total: 0,
  passed: 0,
  failed: 0,
  pending: 0,
  passRate: 0,
  avgScores: {
    grammar: 0,
    fluency: 0,
    pronunciation: 0,
    vocabulary: 0,
    professionalism: 0,
    overall: 0,
  },
  weeklyData: [] as { week: string; passed: number; failed: number }[],
  rubricDistribution: [] as { category: string; scores: number[] }[],
};

export interface InterviewSlot {
  id: string;
  date: string;
  time: string;
  status: 'open' | 'booked' | 'completed' | 'cancelled';
  tutorId?: string;
  tutorName?: string;
  tutorEmail?: string;
  createdAt: string;
  bookedAt?: string;
  notes?: string;
}

export interface InterviewWeekSchedule {
  weekStart: string;
  weekEnd: string;
  slots: InterviewSlot[];
}

export interface PendingInterview {
  id: string;
  date: string;
  time: string;
  tutorId: string;
  tutorName: string;
  tutorEmail: string;
  bookedAt: string;
}

export const interviewApi = {
  getRoom: async (id: string): Promise<{ id: string; tutorId: string; tutorName: string; status: string; result: string | null; hasRecording: boolean; mediaClosed: boolean }> => {
    const { data } = await api.get(`/interview/room/${encodeURIComponent(id)}`);
    if (!data.success) throw Error(data.error || 'Interview not found');
    return data.data;
  },
  /**
   * Create interview slots (Admin)
   */
  createSlots: async (slots: { date: string; time: string }[]): Promise<InterviewSlot[]> => {
    const response = await api.post('/interview/slots', { slots });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to create interview slots');
    }
    return asArray(response.data.data);
  },

  /**
   * Delete interview slots (Admin)
   */
  deleteSlots: async (slotIds: string[]): Promise<void> => {
    const response = await api.delete('/interview/slots', { data: { slotIds } });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete interview slots');
    }
  },

  /**
   * Get interview schedule for a week (Admin view)
   */
  getWeekSchedule: async (weekOffset: number = 0): Promise<InterviewWeekSchedule> => {
    const response = await api.get('/interview/week', { params: { weekOffset } });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get interview schedule');
    }
    const data = response.data.data;
    return data && typeof data === 'object'
      ? {
          weekStart: data.weekStart || '',
          weekEnd: data.weekEnd || '',
          slots: asArray(data.slots || (Array.isArray(data) ? data : [])),
        }
      : { weekStart: '', weekEnd: '', slots: [] };
  },

  /**
   * Get pending interviews (Admin)
   */
  getPendingInterviews: async (limit: number = 20): Promise<PendingInterview[]> => {
    const response = await api.get('/interview/pending', { params: { limit } });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get pending interviews');
    }
    return asArray(response.data.data);
  },

  /**
   * Cancel interview booking (Admin)
   */
  adminCancelBooking: async (slotId: string): Promise<void> => {
    const response = await api.post('/interview/admin/cancel', { slotId });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to cancel interview');
    }
  },

  /**
   * Mark interview as completed (Admin)
   */
  completeInterview: async (slotId: string, notes?: string): Promise<void> => {
    const response = await api.post('/interview/complete', { slotId, notes });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to complete interview');
    }
  },

  /**
   * Save interview result with rubric scores (Admin)
   */
  saveResult: async (
    slotId: string,
    tutorId: string,
    data: {
      rubricScores: {
        grammar: number;
        fluency: number;
        pronunciation: number;
        vocabulary: number;
        professionalism: number;
      };
      timestamps: { time: string; note: string }[];
      result: 'pass' | 'fail';
      notes: string;
    }
  ): Promise<void> => {
    const response = await api.post('/interview/result', {
      slotId,
      tutorId,
      ...data
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to save interview result');
    }
  },

  /**
   * Get interview result (Admin)
   */
  getResult: async (tutorId: string): Promise<{
    rubricScores: {
      grammar: number;
      fluency: number;
      pronunciation: number;
      vocabulary: number;
      professionalism: number;
    };
    timestamps: { time: string; note: string }[];
    result: 'pass' | 'fail' | null;
    notes: string;
    completedAt: string | null;
  } | null> => {
    const response = await api.get(`/interview/result/${tutorId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get interview result');
    }
    return response.data.data ?? null;
  },

  /**
   * Get interview statistics (Admin)
   */
  getStats: async (): Promise<{
    total: number;
    passed: number;
    failed: number;
    pending: number;
    passRate: number;
    avgScores: {
      grammar: number;
      fluency: number;
      pronunciation: number;
      vocabulary: number;
      professionalism: number;
      overall: number;
    };
    weeklyData: { week: string; passed: number; failed: number }[];
    rubricDistribution: { category: string; scores: number[] }[];
  }> => {
    const response = await api.get('/interview/stats');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get interview stats');
    }
    const data = response.data.data;
    return data && typeof data === 'object'
      ? {
          ...emptyInterviewStats,
          ...data,
          avgScores: { ...emptyInterviewStats.avgScores, ...(data.avgScores || {}) },
          weeklyData: asArray(data.weeklyData),
          rubricDistribution: asArray(data.rubricDistribution),
        }
      : emptyInterviewStats;
  },

  /**
   * Get today's interview queue (Admin)
   */
  getTodayQueue: async (): Promise<{
    id: string;
    time: string;
    tutorId: string;
    tutorName: string;
    tutorEmail: string;
    status: string;
  }[]> => {
    const response = await api.get('/interview/today');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get today\'s queue');
    }
    return asArray(response.data.data);
  }
};

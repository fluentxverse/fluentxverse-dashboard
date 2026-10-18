import { apiClient } from './apiClient';

const api = apiClient;

export interface DashboardStats {
  totalTutors: number;
  certifiedTutors: number;
  pendingTutors: number;
  totalStudents: number;
  totalSessions: number;
  totalRevenue: number;
}

export interface ExamStats {
  writtenExams: {
    total: number;
    passed: number;
    failed: number;
  };
  speakingExams: {
    total: number;
    passed: number;
    failed: number;
    processing: number;
  };
}

export interface PendingTutor {
  id: string;
  name: string;
  email: string;
  registeredAt: string;
  status: 'pending_written' | 'pending_speaking' | 'processing';
  writtenExamPassed: boolean;
  speakingExamPassed: boolean;
  interviewResult?: 'pass' | 'fail' | null;
  interviewDate?: string | null;
}

export interface ProfileItemStatus {
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  reviewedAt?: string;
}

export interface ProfileItemStatuses {
  profilePicture: ProfileItemStatus;
  videoIntro: ProfileItemStatus;
  bio: ProfileItemStatus;
  education: ProfileItemStatus;
  interests: ProfileItemStatus;
}

export interface PendingProfileReview {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  bio?: string;
  videoIntroUrl?: string;
  schoolAttended?: string;
  major?: string;
  interests?: string[];
  submittedAt: string;
  profileStatus: 'pending_review' | 'approved' | 'rejected';
  profileItemStatuses?: ProfileItemStatuses;
}

export interface RecentActivity {
  id: string;
  type: 'tutor_registered' | 'exam_passed' | 'exam_failed' | 'student_joined' | 'booking' | 'profile_submitted' | 'profile_change_submitted' | 'minting_started' | 'minting_success' | 'minting_failed';
  message: string;
  timestamp: string | null;
  userId?: string;
}

export interface TutorListItem {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  isBlocked?: boolean;
  blockExpiresAt?: string;
  penaltyBlockOverrideUntil?: string;
  registeredAt: string;
  writtenExamPassed: boolean;
  speakingExamPassed: boolean;
  interviewPassed: boolean;
  writtenExamScore?: number;
  speakingExamScore?: number;
  status: 'pending' | 'certified' | 'processing' | 'failed' | 'pending_profile' | 'test_qualified';
  profileStatus?: 'incomplete' | 'pending_review' | 'approved' | 'rejected';
  zkCertificationStatus?: 'requirements_incomplete' | 'ready_for_proving' | 'local_proof_generated' | 'submitted' | 'verified' | 'failed';
  zkCredentialCommitment?: string;
  zkVerifyTxHash?: string;
  zkVerifyAggregationId?: number;
  zkVerifyDomainId?: string;
  zkVerifyLastError?: string;
  zkVerifyUpdatedAt?: string;
  languages: string[];
  totalSessions: number;
  rating: number;
  // Suspension fields
  isSuspended: boolean;
  suspendedUntil?: string;
  suspendedReason?: string;
  suspendedAt?: string;
}

export interface StudentListItem {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  totalSessions: number;
  totalSpent: number;
  status: 'active' | 'inactive';
  lastActive: string;
  // Suspension fields
  isSuspended: boolean;
  suspendedUntil?: string;
  suspendedReason?: string;
  suspendedAt?: string;
}

export interface SuspensionHistoryItem {
  id: string;
  action: 'suspended' | 'unsuspended' | 'auto-unsuspended';
  reason: string;
  until?: string;
  previousSuspendedUntil?: string;
  previousReason?: string;
  createdAt: string;
  targetType: 'tutor' | 'student';
  suspendedBy?: string;
  unsuspendedBy?: string;
}

export interface AnalyticsData {
  period: string;
  tutorTrend: { date: string; count: number }[];
  studentTrend: { date: string; count: number }[];
  examStats: { type: string; total: number; passed: number }[];
  suspensionStats: { action: string; targetType: string; count: number }[];
  summary: {
    totalTutors: number;
    totalStudents: number;
    suspendedTutors: number;
    suspendedStudents: number;
    newTutors: number;
    newStudents: number;
  };
}

export interface SuspensionAnalytics {
  recentLogs: {
    id: string;
    action: string;
    reason: string;
    targetType: string;
    createdAt: string;
    adminName: string | null;
  }[];
  reasonDistribution: { reason: string; count: number }[];
  monthlyTrend: { month: number; year: number; action: string; count: number }[];
}

// Inbox/System Message types
export type MessageCategory = 'announcement' | 'update' | 'alert' | 'news' | 'promotion';
export type TargetAudience = 'all' | 'students' | 'tutors';
export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SystemMessage {
  id: string;
  title: string;
  content: string;
  category: MessageCategory;
  targetAudience: TargetAudience;
  priority: MessagePriority;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMessageParams {
  title: string;
  content: string;
  category: MessageCategory;
  targetAudience: TargetAudience;
  priority?: MessagePriority;
  createdBy: string;
}

// API Response type
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const asArray = <T,>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : [];

const emptyAnalyticsSummary = {
  totalTutors: 0,
  totalStudents: 0,
  suspendedTutors: 0,
  suspendedStudents: 0,
  newTutors: 0,
  newStudents: 0,
};

export const adminApi = {
  /**
   * Get dashboard overview statistics
   */
  async getStats(): Promise<DashboardStats> {
    const response = await api.get<ApiResponse<DashboardStats>>('/admin/stats');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get stats');
    }
    return response.data.data || {
      totalTutors: 0,
      certifiedTutors: 0,
      pendingTutors: 0,
      totalStudents: 0,
      totalSessions: 0,
      totalRevenue: 0,
    };
  },

  /**
   * Get exam statistics
   */
  async getExamStats(): Promise<ExamStats> {
    const response = await api.get<ApiResponse<ExamStats>>('/admin/exam-stats');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get exam stats');
    }
    return response.data.data || {
      writtenExams: { total: 0, passed: 0, failed: 0 },
      speakingExams: { total: 0, passed: 0, failed: 0, processing: 0 },
    };
  },

  /**
   * Get pending tutors
   */
  async getPendingTutors(limit: number = 10): Promise<PendingTutor[]> {
    const response = await api.get<ApiResponse<PendingTutor[]>>('/admin/pending-tutors', {
      params: { limit }
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get pending tutors');
    }
    return asArray(response.data.data);
  },

  /**
   * Get pending profile reviews
   */
  async getPendingProfiles(limit: number = 20): Promise<PendingProfileReview[]> {
    const response = await api.get<ApiResponse<PendingProfileReview[]>>('/admin/pending-profiles', {
      params: { limit }
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get pending profiles');
    }
    return asArray(response.data.data);
  },

  /**
   * Review a tutor profile (approve/reject)
   */
  async reviewProfile(tutorId: string, action: 'approve' | 'reject', reason?: string): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`/admin/profile/${tutorId}/review`, {
      action,
      reason
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to review profile');
    }
  },

  /**
   * Review a specific profile item (approve/reject)
   */
  async reviewProfileItem(
    tutorId: string, 
    itemKey: 'profilePicture' | 'videoIntro' | 'bio' | 'education' | 'interests',
    action: 'approve' | 'reject', 
    reason?: string
  ): Promise<{ profileItemStatuses: ProfileItemStatuses; allApproved: boolean }> {
    const response = await api.post<ApiResponse<{ profileItemStatuses: ProfileItemStatuses; allApproved: boolean }>>(
      `/admin/profile/${tutorId}/review-item`, 
      { itemKey, action, reason }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to review profile item');
    }
    return response.data.data!;
  },

  /**
   * Get tutors with pending profile changes
   */
  async getPendingChanges(limit: number = 20): Promise<any[]> {
    const response = await api.get<ApiResponse<any[]>>('/admin/pending-changes', {
      params: { limit }
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get pending changes');
    }
    return asArray(response.data.data);
  },

  /**
   * Review a pending profile change for an approved tutor
   */
  async reviewPendingChange(
    tutorId: string,
    changeIndex: number,
    action: 'approve' | 'reject',
    reason?: string
  ): Promise<{ success: boolean; remainingChanges: number }> {
    const response = await api.post<ApiResponse<{ success: boolean; remainingChanges: number }>>(
      `/admin/profile/${tutorId}/review-change`,
      { changeIndex, action, reason }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to review change');
    }
    return response.data.data!;
  },

  /**
   * Get recent activity
   */
  async getRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
    const response = await api.get<ApiResponse<RecentActivity[]>>('/admin/activity', {
      params: { limit }
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get recent activity');
    }
    return asArray(response.data.data);
  },

  /**
   * Get tutors list with filters
   */
  async getTutors(params: {
    page?: number;
    limit?: number;
    status?: 'all' | 'certified' | 'pending' | 'processing' | 'failed' | 'suspended' | 'pending_profile';
    search?: string;
  }): Promise<{ tutors: TutorListItem[]; total: number }> {
    const response = await api.get<ApiResponse<{ tutors: TutorListItem[]; total: number }>>('/admin/tutors', {
      params
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get tutors');
    }
    const data = response.data.data;
    return {
      tutors: asArray(data?.tutors),
      total: data?.total ?? 0,
    };
  },

  /**
   * Retry tutor certification proof submission to zkVerify
   */
  async retryTutorProofSubmission(tutorId: string): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`/admin/tutors/${tutorId}/proof/retry`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to retry tutor proof submission');
    }
  },

  /**
   * Get students list with filters
   */
  async getStudents(params: {
    page?: number;
    limit?: number;
    status?: 'all' | 'active' | 'inactive' | 'suspended';
    search?: string;
  }): Promise<{ students: StudentListItem[]; total: number }> {
    const response = await api.get<ApiResponse<{ students: StudentListItem[]; total: number }>>('/admin/students', {
      params
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get students');
    }
    const data = response.data.data;
    return {
      students: asArray(data?.students),
      total: data?.total ?? 0,
    };
  },

  /**
   * Suspend a tutor
   */
  async suspendTutor(tutorId: string, reason: string, until: string): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`/admin/tutors/${tutorId}/suspend`, {
      reason,
      until
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to suspend tutor');
    }
  },

  /**
   * Unsuspend a tutor
   */
  async unsuspendTutor(tutorId: string): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`/admin/tutors/${tutorId}/unsuspend`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to unsuspend tutor');
    }
  },

  /**
   * Suspend a student
   */
  async suspendStudent(studentId: string, reason: string, until: string): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`/admin/students/${studentId}/suspend`, {
      reason,
      until
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to suspend student');
    }
  },

  /**
   * Unsuspend a student
   */
  async unsuspendStudent(studentId: string): Promise<void> {
    const response = await api.post<ApiResponse<void>>(`/admin/students/${studentId}/unsuspend`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to unsuspend student');
    }
  },

  /**
   * Get suspension history for a tutor
   */
  async getTutorSuspensionHistory(tutorId: string): Promise<SuspensionHistoryItem[]> {
    const response = await api.get<ApiResponse<SuspensionHistoryItem[]>>(`/admin/tutors/${tutorId}/suspension-history`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get suspension history');
    }
    return response.data.data!;
  },

  /**
   * Get suspension history for a student
   */
  async getStudentSuspensionHistory(studentId: string): Promise<SuspensionHistoryItem[]> {
    const response = await api.get<ApiResponse<SuspensionHistoryItem[]>>(`/admin/students/${studentId}/suspension-history`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get suspension history');
    }
    return response.data.data!;
  },

  /**
   * Get comprehensive analytics data
   */
  async getAnalytics(period: string = 'week'): Promise<AnalyticsData> {
    const response = await api.get<ApiResponse<AnalyticsData>>('/admin/analytics', {
      params: { period }
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get analytics');
    }
    const data = response.data.data;
    return {
      period: data?.period || period,
      tutorTrend: asArray(data?.tutorTrend),
      studentTrend: asArray(data?.studentTrend),
      examStats: asArray(data?.examStats),
      suspensionStats: asArray(data?.suspensionStats),
      summary: {
        ...emptyAnalyticsSummary,
        ...(data?.summary || {}),
      },
    };
  },

  /**
   * Get suspension analytics
   */
  async getSuspensionAnalytics(): Promise<SuspensionAnalytics> {
    const response = await api.get<ApiResponse<SuspensionAnalytics>>('/admin/analytics/suspensions');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get suspension analytics');
    }
    const data = response.data.data;
    return {
      recentLogs: asArray(data?.recentLogs),
      reasonDistribution: asArray(data?.reasonDistribution),
      monthlyTrend: asArray(data?.monthlyTrend),
    };
  },

  // ============ INBOX / SYSTEM MESSAGES ============

  /**
   * Get all system messages
   */
  async getSystemMessages(params?: {
    category?: MessageCategory;
    targetAudience?: TargetAudience;
    limit?: number;
    offset?: number;
  }): Promise<{ messages: SystemMessage[]; total: number }> {
    const response = await api.get<ApiResponse<{ messages: SystemMessage[]; total: number }>>('/inbox/admin/messages', {
      params
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get system messages');
    }
    const data = response.data.data;
    return {
      messages: asArray(data?.messages),
      total: data?.total ?? 0,
    };
  },

  /**
   * Create a new system message
   */
  async createSystemMessage(params: CreateMessageParams): Promise<SystemMessage> {
    const response = await api.post<ApiResponse<SystemMessage>>('/inbox/admin/create', params);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to create message');
    }
    return response.data.data!;
  },

  /**
   * Update a system message
   */
  async updateSystemMessage(messageId: string, updates: Partial<CreateMessageParams>): Promise<SystemMessage> {
    const response = await api.put<ApiResponse<SystemMessage>>(`/inbox/admin/update/${messageId}`, updates);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update message');
    }
    return response.data.data!;
  },

  /**
   * Delete a system message
   */
  async deleteSystemMessage(messageId: string): Promise<void> {
    const response = await api.delete<ApiResponse<void>>(`/inbox/admin/delete/${messageId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete message');
    }
  },

  // ============ SESSIONS / LESSONS ============

  /**
   * Get all sessions with filters and pagination
   */
  async getSessions(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<SessionsResponse> {
    const response = await api.get<ApiResponse<SessionsResponse>>('/admin/sessions', { params });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get sessions');
    }
    const data = response.data.data as any;
    const rawSessions = asArray<SessionListItem>(data?.sessions || data);
    const sessions = rawSessions.map(normalizeSessionListItem);
    const total = data?.total ?? sessions.length;
    const limit = params?.limit || 15;
    return {
      sessions,
      total,
      page: data?.page ?? params?.page ?? 1,
      totalPages: data?.totalPages ?? Math.max(1, Math.ceil(total / limit)),
    };
  },

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<SessionStats> {
    const response = await api.get<ApiResponse<SessionStats>>('/admin/sessions/stats');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get session stats');
    }
    return normalizeSessionStats(response.data.data);
  },

  /**
   * Get session details by ID
   */
  async getSessionDetails(sessionId: string): Promise<SessionDetails> {
    const response = await api.get<ApiResponse<SessionDetails>>(`/admin/sessions/${sessionId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get session details');
    }
    return normalizeSessionDetails(response.data.data);
  }
};

const emptySessionStats: SessionStats = {
  totalBookings: 0,
  completedSessions: 0,
  cancelledSessions: 0,
  upcomingSessions: 0,
  todaySessions: 0,
  thisWeekSessions: 0,
  thisMonthSessions: 0,
  noShowSessions: 0,
  completionRate: 0,
  totalHours: 0,
};

const normalizeSessionStats = (value: any): SessionStats => {
  if (!Array.isArray(value)) {
    return { ...emptySessionStats, ...(value || {}) };
  }
  const stats = { ...emptySessionStats };
  value.forEach((row) => {
    const status = String(row?.status || '').toLowerCase();
    const count = Number(row?.count || 0);
    stats.totalBookings += count;
    if (status === 'completed') stats.completedSessions += count;
    if (status === 'cancelled') stats.cancelledSessions += count;
    if (status === 'confirmed' || status === 'booked' || status === 'scheduled') stats.upcomingSessions += count;
    if (status === 'no_show' || status === 'no-show') stats.noShowSessions += count;
  });
  stats.completionRate = stats.totalBookings > 0 ? Math.round((stats.completedSessions / stats.totalBookings) * 100) : 0;
  return stats;
};

const unwrapSession = (value: any) => value?.s || value?.session || value || {};

const normalizeSessionListItem = (value: any): SessionListItem => {
  const session = unwrapSession(value);
  return {
    id: String(session.id || ''),
    tutorId: String(session.tutorId || ''),
    tutorName: String(session.tutorName || session.tutor || 'Unknown tutor'),
    tutorEmail: String(session.tutorEmail || ''),
    tutorAvatar: session.tutorAvatar || session.tutorProfilePicture,
    studentId: String(session.studentId || ''),
    studentName: String(session.studentName || session.student || 'Unknown student'),
    studentEmail: String(session.studentEmail || ''),
    studentAvatar: session.studentAvatar || session.studentProfilePicture,
    slotDate: String(session.slotDate || session.date || ''),
    slotTime: String(session.slotTime || session.time || ''),
    durationMinutes: Number(session.durationMinutes || session.duration || 25),
    status: String(session.status || 'confirmed'),
    attendanceTutor: session.attendanceTutor || session.tutorAttendance || null,
    attendanceStudent: session.attendanceStudent || session.studentAttendance || null,
    bookedAt: String(session.bookedAt || session.createdAt || ''),
    completedAt: session.completedAt || null,
    cancelledAt: session.cancelledAt || null,
    cancelReason: session.cancelReason || null,
  };
};

const normalizeSessionDetails = (value: any): SessionDetails => {
  const source = unwrapSession(value);
  const session = normalizeSessionListItem({
    ...source,
    tutorId: source.tutor?.id ?? source.tutorId,
    tutorName: source.tutor?.name ?? source.tutorName,
    tutorEmail: source.tutor?.email ?? source.tutorEmail,
    tutorAvatar: source.tutor?.avatar ?? source.tutorAvatar,
    studentId: source.student?.id ?? source.studentId,
    studentName: source.student?.name ?? source.studentName,
    studentEmail: source.student?.email ?? source.studentEmail,
    studentAvatar: source.student?.avatar ?? source.studentAvatar,
    slotDate: source.schedule?.date ?? source.slotDate,
    slotTime: source.schedule?.time ?? source.slotTime,
    durationMinutes: source.schedule?.durationMinutes ?? source.durationMinutes,
    attendanceTutor: source.attendance?.tutor ?? source.attendanceTutor,
    attendanceStudent: source.attendance?.student ?? source.attendanceStudent,
    bookedAt: source.timestamps?.bookedAt ?? source.bookedAt,
    completedAt: source.timestamps?.completedAt ?? source.completedAt,
    cancelledAt: source.timestamps?.cancelledAt ?? source.cancelledAt,
  });
  return {
    id: session.id,
    tutor: {
      id: session.tutorId,
      name: session.tutorName,
      email: session.tutorEmail,
      avatar: session.tutorAvatar,
    },
    student: {
      id: session.studentId,
      name: session.studentName,
      email: session.studentEmail,
      avatar: session.studentAvatar,
    },
    schedule: {
      date: session.slotDate,
      time: session.slotTime,
      durationMinutes: session.durationMinutes,
      timezone: source.schedule?.timezone || 'JST',
    },
    status: session.status,
    attendance: {
      tutor: session.attendanceTutor,
      student: session.attendanceStudent,
    },
    timestamps: {
      bookedAt: session.bookedAt,
      completedAt: session.completedAt,
      cancelledAt: session.cancelledAt,
    },
    cancelReason: session.cancelReason,
    ticketUsed: source.ticketUsed || source.ticketId || null,
  };
};

// Session types
export interface SessionListItem {
  id: string;
  tutorId: string;
  tutorName: string;
  tutorEmail: string;
  tutorAvatar?: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentAvatar?: string;
  slotDate: string;
  slotTime: string;
  durationMinutes: number;
  status: string;
  attendanceTutor: string | null;
  attendanceStudent: string | null;
  bookedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface SessionsResponse {
  sessions: SessionListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface SessionStats {
  totalBookings: number;
  completedSessions: number;
  cancelledSessions: number;
  upcomingSessions: number;
  todaySessions: number;
  thisWeekSessions: number;
  thisMonthSessions: number;
  noShowSessions: number;
  completionRate: number;
  totalHours: number;
}

export interface SessionDetails {
  id: string;
  tutor: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  student: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  schedule: {
    date: string;
    time: string;
    durationMinutes: number;
    timezone: string;
  };
  status: string;
  attendance: {
    tutor: string | null;
    student: string | null;
  };
  timestamps: {
    bookedAt: string;
    completedAt: string | null;
    cancelledAt: string | null;
  };
  cancelReason: string | null;
  ticketUsed: string | null;
}

export default adminApi;

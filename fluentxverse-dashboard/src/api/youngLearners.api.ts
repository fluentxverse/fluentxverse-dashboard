/**
 * Young Learners API
 * API functions for managing Young Learners lesson materials
 */
import apiClient from './apiClient';

// ============================================================================
// TYPES
// ============================================================================

export type AgeGroup = '3-5' | '6-8' | '9-12';
export type ActivityType = 'coloring' | 'matching' | 'tracing' | 'counting' | 'sorting' | 'singing' | 'story';
export type LessonTheme = 'animals' | 'colors' | 'numbers' | 'shapes' | 'family' | 'food' | 'weather' | 'body' | 'clothes' | 'nature';
export type LessonStatus = 'draft' | 'published';

export interface VocabularyWord {
  id: string;
  word: string;
  translation: string;
  image: string;
  audio?: string;
}

export interface SongLyric {
  id: string;
  line: string;
  translation?: string;
  timing?: number;
}

export interface Song {
  title: string;
  audioUrl?: string;
  lyrics: SongLyric[];
}

export interface StoryPage {
  id: string;
  image: string;
  text: string;
  translation?: string;
  audio?: string;
}

export interface Story {
  title: string;
  pages: StoryPage[];
}

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  instruction: string;
  instructionJp?: string;
  data: any;
}

export interface YoungLearnersLesson {
  id: string;
  course: string;
  level: number;
  unit: number;
  lessonNumber: number;
  theme: LessonTheme;
  ageGroup: AgeGroup;
  unitLabel: string;
  lessonTitle: string;
  mascot: string;
  backgroundColor: string;
  greeting: string;
  greetingJp?: string;
  
  vocabularyWords: VocabularyWord[];
  song: Song | null;
  story: Story | null;
  activities: Activity[];
  
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  status: LessonStatus;
}

export interface CreateYoungLearnersInput {
  level: number;
  unit: number;
  lessonNumber: number;
  theme: LessonTheme;
  ageGroup: AgeGroup;
  unitName: string;
  lessonName: string;
  mascot: string;
}

export interface UpdateYoungLearnersInput {
  unitLabel?: string;
  lessonTitle?: string;
  theme?: LessonTheme;
  ageGroup?: AgeGroup;
  mascot?: string;
  backgroundColor?: string;
  greeting?: string;
  greetingJp?: string;
  vocabularyWords?: VocabularyWord[];
  song?: Song | null;
  story?: Story | null;
  activities?: Activity[];
  status?: LessonStatus;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * List all Young Learners lessons (admin)
 */
export async function listLessons(): Promise<{ success: boolean; lessons: YoungLearnersLesson[]; error?: string }> {
  try {
    const response = await apiClient.get('/young-learners');
    return response.data;
  } catch (error: any) {
    console.error('Error listing Young Learners lessons:', error);
    return { success: false, lessons: [], error: error.message };
  }
}

/**
 * List published lessons (public)
 */
export async function listPublishedLessons(): Promise<{ success: boolean; lessons: YoungLearnersLesson[]; error?: string }> {
  try {
    const response = await apiClient.get('/young-learners/published');
    return response.data;
  } catch (error: any) {
    console.error('Error listing published Young Learners lessons:', error);
    return { success: false, lessons: [], error: error.message };
  }
}

/**
 * Get a lesson by ID (admin)
 */
export async function getLesson(id: string): Promise<{ success: boolean; lesson: YoungLearnersLesson | null; error?: string }> {
  try {
    const response = await apiClient.get(`/young-learners/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('Error getting Young Learners lesson:', error);
    return { success: false, lesson: null, error: error.message };
  }
}

/**
 * Get a public lesson by ID
 */
export async function getPublicLesson(id: string): Promise<{ success: boolean; lesson: YoungLearnersLesson | null; error?: string }> {
  try {
    const response = await apiClient.get(`/young-learners/public/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('Error getting public Young Learners lesson:', error);
    return { success: false, lesson: null, error: error.message };
  }
}

/**
 * Create a new lesson
 */
export async function createLesson(input: CreateYoungLearnersInput): Promise<{ success: boolean; lesson: YoungLearnersLesson | null; error?: string }> {
  try {
    const response = await apiClient.post('/young-learners', input);
    return response.data;
  } catch (error: any) {
    console.error('Error creating Young Learners lesson:', error);
    return { success: false, lesson: null, error: error.message };
  }
}

/**
 * Update a lesson
 */
export async function updateLesson(id: string, input: UpdateYoungLearnersInput): Promise<{ success: boolean; lesson: YoungLearnersLesson | null; error?: string }> {
  try {
    const response = await apiClient.patch(`/young-learners/${id}`, input);
    return response.data;
  } catch (error: any) {
    console.error('Error updating Young Learners lesson:', error);
    return { success: false, lesson: null, error: error.message };
  }
}

/**
 * Publish a lesson
 */
export async function publishLesson(id: string): Promise<{ success: boolean; lesson: YoungLearnersLesson | null; error?: string }> {
  try {
    const response = await apiClient.post(`/young-learners/${id}/publish`);
    return response.data;
  } catch (error: any) {
    console.error('Error publishing Young Learners lesson:', error);
    return { success: false, lesson: null, error: error.message };
  }
}

/**
 * Unpublish a lesson
 */
export async function unpublishLesson(id: string): Promise<{ success: boolean; lesson: YoungLearnersLesson | null; error?: string }> {
  try {
    const response = await apiClient.post(`/young-learners/${id}/unpublish`);
    return response.data;
  } catch (error: any) {
    console.error('Error unpublishing Young Learners lesson:', error);
    return { success: false, lesson: null, error: error.message };
  }
}

/**
 * Duplicate a lesson
 */
export async function duplicateLesson(id: string): Promise<{ success: boolean; lesson: YoungLearnersLesson | null; error?: string }> {
  try {
    const response = await apiClient.post(`/young-learners/${id}/duplicate`);
    return response.data;
  } catch (error: any) {
    console.error('Error duplicating Young Learners lesson:', error);
    return { success: false, lesson: null, error: error.message };
  }
}

/**
 * Delete a lesson
 */
export async function deleteLesson(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await apiClient.delete(`/young-learners/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('Error deleting Young Learners lesson:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if lesson exists at position
 */
export async function checkDuplicate(level: number, unit: number, lessonNumber: number): Promise<{ success: boolean; exists: boolean; error?: string }> {
  try {
    const response = await apiClient.get(`/young-learners/check-duplicate/${level}/${unit}/${lessonNumber}`);
    return response.data;
  } catch (error: any) {
    console.error('Error checking duplicate:', error);
    return { success: false, exists: false, error: error.message };
  }
}

/**
 * Get existing unit name
 */
export async function getExistingUnitName(level: number, unit: number): Promise<{ success: boolean; unitName: string | null; error?: string }> {
  try {
    const response = await apiClient.get(`/young-learners/unit-name/${level}/${unit}`);
    return response.data;
  } catch (error: any) {
    console.error('Error getting unit name:', error);
    return { success: false, unitName: null, error: error.message };
  }
}

// Default export
const youngLearnersApi = {
  listLessons,
  listPublishedLessons,
  getLesson,
  getPublicLesson,
  createLesson,
  updateLesson,
  publishLesson,
  unpublishLesson,
  duplicateLesson,
  deleteLesson,
  checkDuplicate,
  getExistingUnitName,
};

export default youngLearnersApi;

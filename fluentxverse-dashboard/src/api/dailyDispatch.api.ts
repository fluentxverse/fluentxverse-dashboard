/**
 * Daily Dispatch API
 * API functions for managing Daily Dispatch articles (Memgraph :DispatchArticle nodes)
 */
import apiClient from './apiClient';
import type {
  StoredLesson,
  DispatchArticleListItem,
  DispatchArticleFilters,
  DailyDispatchFormState,
} from '../types/dailyDispatch.types';

const BASE_URL = '/dispatch';

// ============================================================================
// LIST ARTICLES
// ============================================================================

export async function listDispatchArticles(
  filters?: DispatchArticleFilters
): Promise<DispatchArticleListItem[]> {
  const params = new URLSearchParams();
  if (filters?.category) params.append('category', filters.category);
  if (filters?.topic) params.append('topic', filters.topic);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.limit) params.append('limit', String(filters.limit));
  if (filters?.offset) params.append('offset', String(filters.offset));

  const queryString = params.toString();
  const url = queryString ? `${BASE_URL}?${queryString}` : BASE_URL;

  const response = await apiClient.get(url);
  return response.data;
}

// ============================================================================
// GET SINGLE ARTICLE
// ============================================================================

export async function getDispatchArticle(id: string): Promise<StoredLesson> {
  const response = await apiClient.get(`${BASE_URL}/${id}`);
  return response.data;
}

// ============================================================================
// GET ARCHIVES (article counts by month)
// ============================================================================

export interface ArchiveItem {
  month: string;
  count: number;
}

export async function getDispatchArchives(): Promise<ArchiveItem[]> {
  const response = await apiClient.get(`${BASE_URL}/archives`);
  return response.data.archives || [];
}

// ============================================================================
// GET ARTICLES BY MONTH (for archive view)
// ============================================================================

export interface ArchiveArticleItem {
  id: string;
  title: string;
  topic: string;
  category: string;
  createdAt: string;
  excerpt?: string;
}

export async function getDispatchArticlesByMonth(month: string): Promise<ArchiveArticleItem[]> {
  const encodedMonth = encodeURIComponent(month);
  const response = await apiClient.get(`${BASE_URL}/archives/${encodedMonth}`);
  return response.data.articles || [];
}

// ============================================================================
// CREATE ARTICLE
// ============================================================================

export async function createDispatchArticle(
  data: DailyDispatchFormState
): Promise<StoredLesson> {
  const response = await apiClient.post(BASE_URL, data);
  return response.data;
}

// ============================================================================
// UPDATE ARTICLE
// ============================================================================

export async function updateDispatchArticle(
  id: string,
  data: Partial<DailyDispatchFormState>
): Promise<StoredLesson> {
  const response = await apiClient.put(`${BASE_URL}/${id}`, data);
  return response.data;
}

// ============================================================================
// DELETE ARTICLE
// ============================================================================

export async function deleteDispatchArticle(id: string): Promise<void> {
  await apiClient.delete(`${BASE_URL}/${id}`);
}

// ============================================================================
// PUBLISH ARTICLE
// ============================================================================

export async function publishDispatchArticle(id: string): Promise<StoredLesson> {
  const response = await apiClient.post(`${BASE_URL}/${id}/publish`);
  return response.data;
}

// ============================================================================
// UNPUBLISH ARTICLE
// ============================================================================

export async function unpublishDispatchArticle(id: string): Promise<StoredLesson> {
  const response = await apiClient.post(`${BASE_URL}/${id}/unpublish`);
  return response.data;
}

// ============================================================================
// GENERATE WITH AI
// ============================================================================

export async function generateDispatchArticle(prompt: string): Promise<DailyDispatchFormState> {
  const response = await apiClient.post(`${BASE_URL}/generate`, { prompt });
  return response.data;
}

// ============================================================================
// GET CATEGORIES
// ============================================================================

export async function getDispatchCategories(): Promise<string[]> {
  const response = await apiClient.get(`${BASE_URL}/categories`);
  return response.data;
}

// ============================================================================
// GET TOPICS
// ============================================================================

export async function getDispatchTopics(category?: string): Promise<string[]> {
  const url = category
    ? `${BASE_URL}/topics?category=${encodeURIComponent(category)}`
    : `${BASE_URL}/topics`;
  const response = await apiClient.get(url);
  return response.data;
}

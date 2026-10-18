import { apiClient } from './apiClient';
import { API_BASE_URL } from '../config/api';

const api = apiClient;

// Types
export type TicketTier = 'basic' | 'premium' | 'trial';

// Simplified Ticket interface - stored on-chain
export interface Ticket {
  tokenId: string;
  tier: TicketTier;
  price: number;
  supply: number;
  name: string;
  description: string;
  imageUri?: string;
  createdAt: string;
  contractAddress: string;
}

export interface TicketStats {
  totalTicketTypes: number;
  totalSupply: number;
  basicTicket: Ticket | null;
  premiumTicket: Ticket | null;
  trialTicket: Ticket | null;
}

export interface CreateTicketRequest {
  tier: TicketTier;
  price: number;
  supply: number;
}

// Minting response with transaction tracking
export interface MintingResponse {
  ticket: Ticket;
  transactionId: string;
}

// Minting update notification
export interface MintingUpdate {
  type: 'minting_started' | 'minting_success' | 'minting_failed';
  transactionId: string;
  tier: TicketTier;
  supply: number;
  mintType: 'create' | 'additional';
  tokenId?: string;
  errorMessage?: string;
  timestamp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Get all tickets from contract (source of truth)
export async function getTickets(): Promise<Ticket[]> {
  const response = await api.get<ApiResponse<Ticket[]>>('/tickets');

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to get tickets');
  }

  return response.data.data || [];
}

// Get ticket statistics
export async function getTicketStats(): Promise<TicketStats> {
  const response = await api.get<ApiResponse<TicketStats>>('/tickets/stats');

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to get ticket stats');
  }

  return response.data.data!;
}

// Create new ticket (Basic or Premium)
// Returns immediately with transactionId - listen for minting:update socket events
export async function createTicket(data: CreateTicketRequest): Promise<MintingResponse> {
  const response = await api.post<ApiResponse<MintingResponse>>('/tickets', data);

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to create ticket');
  }

  return response.data.data!;
}

// Mint additional supply for existing ticket
// Returns immediately with transactionId - listen for minting:update socket events
export async function mintAdditional(
  tokenId: string,
  quantity: number
): Promise<MintingResponse> {
  const response = await api.post<ApiResponse<MintingResponse>>(
    `/tickets/${tokenId}/mint`,
    { quantity }
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to mint additional supply');
  }

  return response.data.data!;
}

// Get ticket image URL
export async function getTicketImageUrl(tier: TicketTier): Promise<string> {
  const response = await api.get<ApiResponse<{ tier: string; url: string }>>(
    `/tickets/image/${tier}`
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to get ticket image');
  }

  return `${API_BASE_URL}${response.data.data!.url}`;
}

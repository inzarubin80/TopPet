import { axiosClient } from './axiosClient';

export type LegalDocumentSummary = {
  id: string;
  title: string;
  version: string;
};

export type LegalDocument = LegalDocumentSummary & {
  content: string;
};

export async function listLegalDocuments(): Promise<LegalDocumentSummary[]> {
  const response = await axiosClient.get<LegalDocumentSummary[]>('/legal/documents');
  return response.data;
}

export async function getLegalDocument(id: string): Promise<LegalDocument> {
  const response = await axiosClient.get<LegalDocument>(`/legal/documents/${encodeURIComponent(id)}`);
  return response.data;
}

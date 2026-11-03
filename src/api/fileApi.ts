import { apiFetch, getApiConfig } from './config';
import { FileDetail, FileMetadata, UploadFilePayload } from './types';

export const fileApi = {
  /**
   * Upload an image or file as base64 or from a remote URL.
   * POST /file
   */
  async uploadFile(payload: UploadFilePayload): Promise<FileMetadata> {
    return apiFetch<FileMetadata>('/file', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Get file metadata and base64 contents.
   * GET /file/:id
   */
  async getFile(id: string): Promise<FileDetail> {
    return apiFetch<FileDetail>(`/file/${id}`);
  },

  /**
   * Returns the direct download/display URL for raw bytes.
   */
  getDownloadUrl(id: string): string {
    const { baseUrl } = getApiConfig();
    return `${baseUrl}/file/${id}/download`;
  },
};


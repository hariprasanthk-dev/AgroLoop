import api from './axios';
import type { ApiResponse } from '../types';

export interface UploadResponse {
  url: string;
  publicId: string;
}

export const uploadApi = {
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    return api.post<ApiResponse<UploadResponse>>('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

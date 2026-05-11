import axios from 'axios';
import { getApiBaseUrl } from '../config';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true, // This ensures cookies are sent with requests
  // 5 minutes covers slow networks uploading large PDFs/images.
  // Without an explicit timeout, axios defaults to 0 (infinite) so stuck
  // sockets would hang forever instead of failing fast.
  timeout: 5 * 60 * 1000,
  // Allow large request/response bodies (default is 10MB / 2MB in axios).
  maxContentLength: 50 * 1024 * 1024,
  maxBodyLength: 50 * 1024 * 1024,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for debugging
apiClient.interceptors.request.use(
  (config) => {
    console.log('🚀 API Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      withCredentials: config.withCredentials,
    });
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for debugging
apiClient.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', {
      status: response.status,
      url: response.config.url,
      data: response.data,
    });
    return response;
  },
  (error) => {
    console.error('❌ API Error:', {
      status: error.response?.status,
      url: error.config?.url,
      message: error.message,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);

export default apiClient;


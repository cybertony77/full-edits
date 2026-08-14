import { useQuery } from '@tanstack/react-query';
import apiClient from '../axios';

export const systemKeys = {
  all: ['system'],
  config: () => [...systemKeys.all, 'config', 'features-v2'],
};

const systemApi = {
  getConfig: async () => {
    const response = await apiClient.get('/api/system/config');
    return response.data;
  },
};

export const useSystemConfig = (options = {}) => {
  return useQuery({
    queryKey: systemKeys.config(),
    queryFn: () => systemApi.getConfig(),
    // Always re-read feature flags from env.config (no long-lived cache).
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
    ...options,
  });
};

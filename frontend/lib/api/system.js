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

/**
 * Feature flags are stored as booleans or string booleans in env.config.
 * Treat missing config as unknown (false here); callers must check loading first.
 */
export function isFeatureEnabled(config, feature) {
  const value = config?.[feature];
  return value === true || value === 'true' || value === 1 || value === '1';
}

export const useSystemConfig = (options = {}) => {
  return useQuery({
    queryKey: systemKeys.config(),
    queryFn: () => systemApi.getConfig(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
    ...options,
  });
};

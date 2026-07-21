import { useQuery } from '@tanstack/react-query';
import apiClient from '../axios';

export const systemKeys = {
  all: ['system'],
  config: () => [...systemKeys.all, 'config', 'grades-v1'],
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
    // Override _app.js defaults (staleTime: Infinity, refetchOnMount: false)
    // so GRADES_OR_COURSES updates from env.config are picked up.
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 1,
    ...options,
  });
};

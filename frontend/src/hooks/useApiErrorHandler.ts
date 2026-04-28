import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export function useApiErrorHandler() {
  const queryClient = useQueryClient();

  const handleApiError = useCallback((error: any, context?: string) => {
    const message = error?.response?.data?.message || error?.message || '请求失败';
    const status = error?.response?.status;

    console.error(`[API Error${context ? ` - ${context}` : ''}]`, message);

    if (status === 401) {
      console.error('API 认证失败，请检查 API Key 配置');
    } else if (status === 403) {
      console.error('API 权限不足');
    } else if (status === 500) {
      console.error('服务器内部错误');
    }

    return { message, status };
  }, []);

  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  return { handleApiError, refreshAll };
}

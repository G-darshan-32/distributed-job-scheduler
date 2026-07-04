import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// Generic paginated list hook
export function useList<T>(key: string[], url: string, params?: Record<string, unknown>) {
  return useQuery<{ data: T[]; meta: { total: number; page: number; totalPages: number } }>({
    queryKey: [...key, params],
    queryFn: async () => {
      const { data } = await api.get(url, { params });
      return data;
    },
  });
}

export function useItem<T>(key: string[], url: string) {
  return useQuery<{ data: T }>({
    queryKey: key,
    queryFn: async () => {
      const { data } = await api.get(url);
      return data;
    },
  });
}

export function useCreate<T, D = unknown>(url: string, invalidateKeys?: string[][]) {
  const qc = useQueryClient();
  return useMutation<T, Error, D>({
    mutationFn: async (body: D) => {
      const { data } = await api.post(url, body);
      return data.data;
    },
    onSuccess: () => {
      invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useAction<T = unknown>(
  method: 'post' | 'patch' | 'delete',
  url: string,
  invalidateKeys?: string[][]
) {
  const qc = useQueryClient();
  return useMutation<T, Error, unknown>({
    mutationFn: async (body?: unknown) => {
      const { data } =
        method === 'delete' ? await api.delete(url) : await api[method](url, body);
      return data;
    },
    onSuccess: () => {
      invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

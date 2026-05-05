import { useState, useEffect, useCallback } from "react";
import { apiClient, ApiError } from "../api/client";

interface UseFetchResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFetch<T>(url: string | null): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(!!url);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<T>(url);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchData is async; setState calls happen after await, not synchronously
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

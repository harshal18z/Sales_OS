import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// --- Query Key Serialization ---
function serializeKey(key: unknown): string {
  try {
    return JSON.stringify(key, (_, val) => {
      if (typeof val === "function") return undefined;
      return val;
    });
  } catch {
    return String(key);
  }
}

function keyMatches(filterKey?: unknown, queryKey?: unknown): boolean {
  if (!filterKey) return true;
  if (!queryKey) return false;
  if (Array.isArray(filterKey) && Array.isArray(queryKey)) {
    if (filterKey.length > queryKey.length) return false;
    for (let i = 0; i < filterKey.length; i++) {
      if (filterKey[i] !== undefined && serializeKey(filterKey[i]) !== serializeKey(queryKey[i])) {
        return false;
      }
    }
    return true;
  }
  return serializeKey(filterKey) === serializeKey(queryKey);
}

// --- Query State & Entry ---
type QueryRecord<T = unknown> = {
  key: unknown;
  data: T | undefined;
  error: Error | null;
  status: "idle" | "pending" | "success" | "error";
  isFetching: boolean;
  updatedAt: number;
};

type Listener = () => void;

export class QueryClient {
  private cache = new Map<string, QueryRecord>();
  private listeners = new Map<string, Set<Listener>>();
  private globalListeners = new Set<Listener>();

  getQueryState<T>(key: unknown): QueryRecord<T> | undefined {
    return this.cache.get(serializeKey(key)) as QueryRecord<T> | undefined;
  }

  getQueryData<T>(key: unknown): T | undefined {
    return this.getQueryState<T>(key)?.data;
  }

  setQueryData<T>(key: unknown, updater: T | ((old: T | undefined) => T)): T {
    const sKey = serializeKey(key);
    const existing = this.getQueryState<T>(key);
    const oldData = existing?.data;
    const newData = typeof updater === "function" ? (updater as (old?: T) => T)(oldData) : updater;

    const record: QueryRecord<T> = {
      key,
      data: newData,
      error: null,
      status: "success",
      isFetching: false,
      updatedAt: Date.now(),
    };
    this.cache.set(sKey, record as QueryRecord);
    this.notify(sKey);
    return newData;
  }

  invalidateQueries(filters?: { queryKey?: unknown; refetchType?: string }): void {
    const filterKey = filters?.queryKey;
    for (const [sKey, record] of this.cache.entries()) {
      if (!filterKey || keyMatches(filterKey, record.key)) {
        // Mark stale
        record.updatedAt = 0;
        this.notify(sKey);
      }
    }
    // Also notify global listeners
    this.globalListeners.forEach((l) => l());
  }

  subscribe(key: unknown, listener: Listener): () => void {
    const sKey = serializeKey(key);
    if (!this.listeners.has(sKey)) {
      this.listeners.set(sKey, new Set());
    }
    this.listeners.get(sKey)!.add(listener);

    return () => {
      const set = this.listeners.get(sKey);
      if (set) {
        set.delete(listener);
        if (set.size === 0) this.listeners.delete(sKey);
      }
    };
  }

  subscribeGlobal(listener: Listener): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  private notify(sKey: string): void {
    this.listeners.get(sKey)?.forEach((l) => l());
    this.globalListeners.forEach((l) => l());
  }
}

const QueryClientContext = createContext<QueryClient | null>(null);

export function QueryClientProvider({
  client,
  children,
}: {
  client: QueryClient;
  children: ReactNode;
}) {
  return <QueryClientContext.Provider value={client}>{children}</QueryClientContext.Provider>;
}

export function useQueryClient(): QueryClient {
  const client = useContext(QueryClientContext);
  if (!client) {
    throw new Error("useQueryClient must be used within a QueryClientProvider");
  }
  return client;
}

// --- useQuery ---
export interface UseQueryOptions<TData = unknown, TError = Error> {
  queryKey: unknown[];
  queryFn: () => Promise<TData>;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  retry?: boolean | number;
  refetchOnWindowFocus?: boolean;
  refetchInterval?:
    number | false | ((query: { state: { data: TData | undefined } }) => number | false);
  initialData?: TData;
}

export interface UseQueryResult<TData = unknown, TError = Error> {
  data: TData | undefined;
  error: TError | null;
  isLoading: boolean;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => Promise<TData | undefined>;
}

export function useQuery<TData = unknown, TError = Error>(
  options: UseQueryOptions<TData, TError>,
): UseQueryResult<TData, TError> {
  const { queryKey, queryFn, enabled = true, refetchInterval, initialData } = options;
  const client = useQueryClient();
  const sKey = serializeKey(queryKey);

  const initialRecord = client.getQueryState<TData>(queryKey);
  const [data, setData] = useState<TData | undefined>(() => initialRecord?.data ?? initialData);
  const [error, setError] = useState<TError | null>(
    () => (initialRecord?.error as TError | null) ?? null,
  );
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [hasFetchedOnce, setHasFetchedOnce] = useState<boolean>(
    () => !!initialRecord || initialData !== undefined,
  );

  const isMounted = useRef(true);
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const fetchQuery = useCallback(async (): Promise<TData | undefined> => {
    if (!enabled) return;
    setIsFetching(true);
    try {
      const result = await queryFnRef.current();
      if (isMounted.current) {
        client.setQueryData<TData>(queryKey, result);
        setData(result);
        setError(null);
        setHasFetchedOnce(true);
      }
      return result;
    } catch (err) {
      if (isMounted.current) {
        const errorObj = (err instanceof Error ? err : new Error(String(err))) as TError;
        setError(errorObj);
      }
      return undefined;
    } finally {
      if (isMounted.current) {
        setIsFetching(false);
      }
    }
  }, [client, enabled, sKey]);

  // Initial fetch and on sKey / enabled change
  useEffect(() => {
    isMounted.current = true;
    if (enabled) {
      fetchQuery();
    }
    return () => {
      isMounted.current = false;
    };
  }, [fetchQuery, enabled, sKey]);

  // Subscribe to cache updates (from invalidateQueries or setQueryData)
  useEffect(() => {
    const unsub = client.subscribe(queryKey, () => {
      const state = client.getQueryState<TData>(queryKey);
      if (state) {
        if (state.updatedAt === 0 && enabled) {
          fetchQuery();
        } else {
          setData(state.data);
          setError(state.error as TError | null);
        }
      }
    });
    return unsub;
  }, [client, enabled, fetchQuery, sKey]);

  // Interval polling
  useEffect(() => {
    if (!enabled || !refetchInterval) return;
    let intervalMs: number | false = false;
    if (typeof refetchInterval === "function") {
      intervalMs = refetchInterval({ state: { data } });
    } else {
      intervalMs = refetchInterval;
    }
    if (!intervalMs || intervalMs <= 0) return;

    const timer = setInterval(() => {
      fetchQuery();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [enabled, refetchInterval, fetchQuery, data]);

  const isLoading = !hasFetchedOnce && isFetching;
  const isPending = isLoading;
  const isError = error !== null;
  const isSuccess = hasFetchedOnce && !isError;

  return {
    data,
    error,
    isLoading,
    isPending,
    isFetching,
    isError,
    isSuccess,
    refetch: fetchQuery,
  };
}

// --- useMutation ---
export interface UseMutationOptions<TData = unknown, TVariables = void, TError = Error> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => unknown;
  onError?: (error: TError, variables: TVariables) => unknown;
  onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables) => unknown;
}

export interface UseMutationResult<TData = unknown, TVariables = void, TError = Error> {
  mutate: (variables?: TVariables) => void;
  mutateAsync: (variables?: TVariables) => Promise<TData>;
  isPending: boolean;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  error: TError | null;
  data: TData | undefined;
  variables: TVariables | undefined;
  reset: () => void;
}

export function useMutation<TData = unknown, TVariables = void, TError = Error>(
  options: UseMutationOptions<TData, TVariables, TError>,
): UseMutationResult<TData, TVariables, TError> {
  const [data, setData] = useState<TData | undefined>(undefined);
  const [error, setError] = useState<TError | null>(null);
  const [variables, setVariables] = useState<TVariables | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mutateAsync = useCallback(async (vars?: TVariables): Promise<TData> => {
    setIsPending(true);
    setError(null);
    setIsSuccess(false);
    setVariables(vars);
    try {
      const result = await optionsRef.current.mutationFn(vars as TVariables);
      setData(result);
      setIsSuccess(true);
      if (optionsRef.current.onSuccess) {
        await optionsRef.current.onSuccess(result, vars as TVariables);
      }
      if (optionsRef.current.onSettled) {
        await optionsRef.current.onSettled(result, null, vars as TVariables);
      }
      return result;
    } catch (err) {
      const errObj = (err instanceof Error ? err : new Error(String(err))) as TError;
      setError(errObj);
      if (optionsRef.current.onError) {
        await optionsRef.current.onError(errObj, vars as TVariables);
      }
      if (optionsRef.current.onSettled) {
        await optionsRef.current.onSettled(undefined, errObj, vars as TVariables);
      }
      throw errObj;
    } finally {
      setIsPending(false);
    }
  }, []);

  const mutate = useCallback(
    (vars?: TVariables) => {
      mutateAsync(vars).catch(() => {});
    },
    [mutateAsync],
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setVariables(undefined);
    setIsPending(false);
    setIsSuccess(false);
  }, []);

  return {
    mutate,
    mutateAsync,
    isPending,
    isLoading: isPending,
    isError: error !== null,
    isSuccess,
    error,
    data,
    variables,
    reset,
  };
}

import { useState, useCallback, useEffect } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useAsync<T = unknown>() {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (
      asyncFunction: () => Promise<T>,
      onSuccess?: (data: T) => void,
      onError?: (error: string) => void
    ) => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const data = await asyncFunction();
        setState(prev => ({ ...prev, data, loading: false }));
        onSuccess?.(data);
        return data;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        setState(prev => ({ ...prev, error: errorMessage, loading: false }));
        onError?.(errorMessage);
        throw error;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

// Hook for paginated data
export function usePaginatedData<T>(
  fetchFunction: (
    page: number,
    limit?: number
  ) => Promise<{ data: T[]; hasMore: boolean; cursor?: unknown }>,
  options: { initialLimit?: number; enabled?: boolean } = {}
) {
  const { initialLimit = 20, enabled = true } = options;
  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(
    async (reset = false) => {
      if (!enabled || loading || (!reset && !hasMore)) return;

      if (reset) {
        setData([]);
        setPage(1);
        setHasMore(true);
      }

      setLoading(true);
      setError(null);

      try {
        const result = await fetchFunction(reset ? 1 : page + 1, initialLimit);
        setData(prev => (reset ? result.data : [...prev, ...result.data]));
        setHasMore(result.hasMore);
        setPage(prev => (reset ? 1 : prev + 1));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [fetchFunction, page, hasMore, loading, enabled, initialLimit]
  );

  const reset = useCallback(() => {
    setData([]);
    setPage(1);
    setHasMore(true);
    setError(null);
  }, []);

  return {
    data,
    loading,
    error,
    hasMore,
    loadMore,
    reset,
  };
}

// Hook for debounced operations
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Hook for infinite scroll
export function useInfiniteScroll(callback: () => void, options: { threshold?: number } = {}) {
  const { threshold = 100 } = options;
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    function handleScroll() {
      if (
        window.innerHeight + document.documentElement.scrollTop + threshold >=
        document.documentElement.offsetHeight
      ) {
        setIsFetching(true);
      }
    }

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  useEffect(() => {
    if (!isFetching) return;

    const fetchData = async () => {
      try {
        await callback();
      } catch (error) {
        console.error('Error in infinite scroll:', error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, [isFetching, callback]);

  return [isFetching, setIsFetching] as const;
}

// Hook for form state with validation
export function useFormState<T extends Record<string, unknown>>(
  initialValues: T,
  validate?: (values: T) => { isValid: boolean; errors: Partial<Record<keyof T, string>> }
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = useCallback(
    (name: keyof T, value: unknown) => {
      if (!validate) return;
      const validation = validate({ ...values, [name]: value });
      if (validation.errors[name]) {
        setErrors(prev => ({ ...prev, [name]: validation.errors[name] }));
      } else {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    },
    [values, validate]
  );

  const setValue = useCallback(
    (name: keyof T, value: unknown) => {
      setValues(prev => ({ ...prev, [name]: value }));
      if (touched[name]) {
        validateField(name, value);
      }
    },
    [touched, validateField]
  );

  const setTouchedField = useCallback(
    (name: keyof T, isTouched = true) => {
      setTouched(prev => ({ ...prev, [name]: isTouched }));
      if (values[name] !== undefined) {
        validateField(name, values[name]);
      }
    },
    [values, validateField]
  );

  const validateForm = useCallback(() => {
    if (!validate) return true;
    const validation = validate(values);
    setErrors(validation.errors);
    return validation.isValid;
  }, [values, validate]);

  const handleSubmit = useCallback(
    async (onSubmit: (values: T) => Promise<void> | void) => {
      if (!validateForm()) return;

      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } catch (error) {
        console.error('Form submission error:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validateForm]
  );

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    setValue,
    setTouchedField,
    validateForm,
    handleSubmit,
    reset,
    isFormValid: Object.keys(errors).length === 0,
  };
}

// Hook for local storage
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue] as const;
}

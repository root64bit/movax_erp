import { useState, useEffect } from 'react';

export function useDebouncedSearch(initialValue = '', delay = 300) {
  const [inputValue, setInputValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, delay);

    return () => clearTimeout(timer);
  }, [inputValue, delay]);

  return [debouncedValue, inputValue, setInputValue] as const;
}

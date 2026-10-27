"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useAsyncData(loader, key, { enabled = true } = {}) {
  const loaderRef = useRef(loader);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(enabled) });

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  const run = useCallback(async () => {
    if (inFlightRef.current) return null;

    inFlightRef.current = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const data = await loaderRef.current();
      if (requestIdRef.current === requestId) {
        setState({ data, error: null, loading: false });
      }
      return data;
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setState({ data: null, error, loading: false });
      }
      return null;
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current += 1;
      return undefined;
    }

    run();
  }, [key, enabled, run]);

  const setData = useCallback((updater) => {
    setState((previous) => ({
      ...previous,
      data: typeof updater === "function" ? updater(previous.data) : updater,
    }));
  }, []);

  if (!enabled) {
    return { data: null, error: null, loading: false, refetch: run, setData };
  }

  return { ...state, refetch: run, setData };
}

export function usePolling(callback, { enabled = false, intervalMs = 2500, maxAttempts = 60 } = {}) {
  const callbackRef = useRef(callback);
  const attemptsRef = useRef(0);
  const inFlightRef = useRef(false);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;

    attemptsRef.current = 0;

    const tick = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      attemptsRef.current += 1;

      if (attemptsRef.current > maxAttempts) {
        inFlightRef.current = false;
        setGaveUp(true);
        return;
      }

      try {
        await callbackRef.current();
      } finally {
        inFlightRef.current = false;
      }
    };

    const timer = setInterval(tick, intervalMs);
    return () => {
      clearInterval(timer);
      inFlightRef.current = false;
    };
  }, [enabled, intervalMs, maxAttempts]);

  return { gaveUp: enabled ? gaveUp : false };
}

export function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function useCopyToClipboard(resetMs = 2200) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = useCallback(
    async (text) => {
      let success = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          success = true;
        }
      } catch {
        success = false;
      }

      if (!success) {
        try {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.setAttribute("readonly", "");
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          success = document.execCommand("copy");
          document.body.removeChild(textarea);
        } catch {
          success = false;
        }
      }

      if (success) {
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), resetMs);
      }
      return success;
    },
    [resetMs],
  );

  return { copied, copy };
}
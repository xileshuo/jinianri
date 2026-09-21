export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  ms: number
): T & { flush: () => void; cancel: () => void } {
  let timer: number | null = null;
  let pending: (() => void) | null = null;

  const wrapped = ((...args: never[]) => {
    pending = () => fn(...args);
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      pending?.();
      pending = null;
    }, ms);
  }) as T & { flush: () => void; cancel: () => void };

  wrapped.flush = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    if (pending) {
      pending();
      pending = null;
    }
  };

  wrapped.cancel = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    pending = null;
  };

  return wrapped;
}

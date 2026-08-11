export type ToastType = "success" | "error" | "info";

export type ToastEvent = {
  id: number;
  message: string;
  type: ToastType;
};

type Listener = (event: ToastEvent) => void;
const listeners = new Set<Listener>();

let idCounter = 0;

export const toast = {
  success: (message: string) => emit(message, "success"),
  error: (message: string) => emit(message, "error"),
  info: (message: string) => emit(message, "info"),
};

function emit(message: string, type: ToastType) {
  const event: ToastEvent = { id: idCounter++, message, type };
  listeners.forEach((listener) => listener(event));
}

export const subscribeToasts = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

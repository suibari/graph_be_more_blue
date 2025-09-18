import { writable } from 'svelte/store';

export interface Snackbar {
  message: string;
  type: 'success' | 'error' | 'info';
  show: boolean;
  link?: {
    href: string;
    text: string;
  };
}

const defaultSnackbar: Snackbar = {
  message: '',
  type: 'info',
  show: false,
};

export const snackbar = writable<Snackbar>(defaultSnackbar);

export function showSnackbar(message: string, type: 'success' | 'error' | 'info' = 'info', link?: { href: string; text: string }) {
  snackbar.set({ message, type, show: true, link });
}

export function hideSnackbar() {
  snackbar.set({ ...defaultSnackbar, show: false });
}

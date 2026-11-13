// Basis design system, loaded at runtime from index.html (https://design-system-bc6.pages.dev/v1).
// Optional because the app should keep working if the script fails to load.
interface Window {
  DS?: {
    version: string;
    getTheme(): 'light' | 'dark' | 'system';
    setTheme(theme: 'light' | 'dark' | 'system', persist?: boolean): void;
    syncRange(input?: HTMLInputElement): void;
    toast(message: string, options?: {
      variant?: 'info' | 'success' | 'warning' | 'danger';
      duration?: number;
      action?: { label: string; onClick: () => void };
    }): { dismiss(): void };
  };
}

export type Theme = 'light' | 'dark';

export function toggleTheme(): void {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? 'light' : 'dark');
}

export function setTheme(theme: Theme): void {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.theme = theme;
    window.dispatchEvent(new Event("themeToggled"));
}

export function initializeTheme(): void {
    const savedTheme = localStorage.theme as Theme;
    setTheme(savedTheme ?? 'light');
}

// Only used in profile page to load saved preferences
export async function loadPreferences(): Promise<void> {
    try {
        const response = await fetch('/api/preferences/get');
        if (!response.ok) return;

        const preferences = await response.json();
        if (preferences.theme) {
            setTheme(preferences.theme);
        }
    } catch (error) {
        console.error('Failed to load preferences:', error);
    }
}
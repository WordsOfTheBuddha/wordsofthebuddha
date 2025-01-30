export type Theme = 'light' | 'dark';

export interface UserPreferences {
    theme?: 'light' | 'dark';
    showPali?: boolean;
}

let preferencesLoaded = false;

// Update setPaliState to only handle UI and localStorage
export function setPaliState(enabled: boolean): void {
    localStorage.setItem('paliMode', enabled.toString());
    setUIState({ showPali: enabled });
}

// Add function to handle navigation with Pali state
export function handleNavigation(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href && !anchor.hasAttribute('download') && anchor.target !== '_blank') {
        event.preventDefault();
        const url = new URL(anchor.href);
        const currentPali = localStorage.getItem('paliMode') === 'true';

        if (currentPali) {
            url.searchParams.set('pli', 'true');
        }

        window.location.href = url.toString();
    }
}

export function setUIState(preferences: Partial<UserPreferences>): void {
    if (preferences.theme) {
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(preferences.theme);
        localStorage.theme = preferences.theme;
    }

    if (preferences.showPali !== undefined) {
        localStorage.setItem('paliMode', preferences.showPali.toString());
        const url = new URL(window.location.href);
        if (preferences.showPali) {
            url.searchParams.set('pli', 'true');
        } else {
            url.searchParams.delete('pli');
        }
        window.history.replaceState({}, '', url.toString());
        // Don't reload here, let the caller decide
    }
}

// Add new function to synchronize all UI states
export function synchronizePreferences(preferences: Partial<UserPreferences>) {
    console.log("in synchronize preferences, pali mode is: ", preferences.showPali);
    console.log("in synchronize preferences, theme is: ", preferences.theme);
    if (preferences.showPali !== undefined) {
        localStorage.setItem('paliMode', preferences.showPali.toString());
        const url = new URL(window.location.href);
        if (preferences.showPali) {
            url.searchParams.set('pli', 'true');
        } else {
            url.searchParams.delete('pli');
        }
        window.history.replaceState({}, '', url.toString());
    }

    if (preferences.theme) {
        localStorage.theme = preferences.theme;
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(preferences.theme);
    }
}

export async function loadPreferences(): Promise<UserPreferences> {
    if (preferencesLoaded) {
        return {};
    }

    try {
        const response = await fetch('/api/preferences/get');
        if (!response.ok) throw new Error('Failed to load preferences');

        const data = await response.json();
        const prefs: UserPreferences = {
            theme: data['theme'] || localStorage.getItem('theme') || 'dark',
            showPali: data['showPali']
        };

        synchronizePreferences(prefs);
        preferencesLoaded = true;
        return prefs;
    } catch (error) {
        console.error('Error loading preferences:', error);
        return {};
    }
}

export function toggleTheme(): void {
    const isDark = document.documentElement.classList.contains("dark");
    setUIState({ theme: isDark ? 'light' : 'dark' });
}

export function setTheme(theme: Theme): void {
    setUIState({ theme });
}
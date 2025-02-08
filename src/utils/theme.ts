export type Theme = 'light' | 'dark';
export type FontSize = 'large' | 'larger';

export interface UserPreferences {
    theme?: Theme;
    showPali?: boolean;
    fontSize?: FontSize;
    enablePaliLookup?: boolean;
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

// Simplify setUIState to only handle storage
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

    if (preferences.fontSize) {
        localStorage.setItem('fontSize', preferences.fontSize);
    }
}

// Add new function to synchronize all UI states
export function synchronizePreferences(preferences: Partial<UserPreferences>) {
    /*console.log("in synchronize preferences, pali mode is: ", preferences.showPali);
    console.log("in synchronize preferences, theme is: ", preferences.theme);
    console.log("in synchronize preferences, font size is: ", preferences.fontSize);*/

    if (preferences.showPali !== undefined && localStorage.getItem('paliMode') !== preferences.showPali.toString()) {
        localStorage.setItem('paliMode', preferences.showPali.toString());
    }

    if (preferences.theme && localStorage.theme !== preferences.theme) {
        localStorage.theme = preferences.theme;
    }

    if (preferences.fontSize && localStorage.fontSize !== preferences.fontSize) {
        localStorage.setItem('fontSize', preferences.fontSize);
    }

    if (preferences.enablePaliLookup !== undefined && localStorage.getItem('enablePaliLookup') !== preferences.enablePaliLookup.toString()) {
        localStorage.setItem('paliLookup', preferences.enablePaliLookup.toString());
    }

    // Clean up URL parameters
    const url = new URL(window.location.href);
    if (url.searchParams.has('load-preferences')) {
        url.searchParams.delete('load-preferences');
    }

    if (url.searchParams.has('theme')) {
        url.searchParams.delete('theme');
    }

    if (url.searchParams.has('enablePaliLookup')) {
        url.searchParams.delete('enablePaliLookup');
    }

    window.history.replaceState({}, '', url.toString());
}

export function toggleTheme(): void {
    const isDark = document.documentElement.classList.contains("dark");
    setUIState({ theme: isDark ? 'light' : 'dark' });
}

export function setTheme(theme: Theme): void {
    setUIState({ theme });
}
// Theme-aware color utility functions
// Returns appropriate colors based on current theme

export const getThemeColors = (isDark: boolean) => {
  return {
    // Backgrounds
    bgPrimary: isDark ? '#1f2937' : '#ffffff',
    bgSecondary: isDark ? '#111827' : '#f9fafb',
    bgTertiary: isDark ? '#374151' : '#f3f4f6',
    bgHover: isDark ? '#374151' : '#f3f4f6',
    
    // Text colors
    textPrimary: isDark ? '#f9fafb' : '#1f2937',
    textSecondary: isDark ? '#d1d5db' : '#4b5563',
    textTertiary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    
    // Borders
    borderPrimary: isDark ? '#374151' : '#e5e7eb',
    borderSecondary: isDark ? '#4b5563' : '#d1d5db',
    borderTertiary: isDark ? '#6b7280' : '#9ca3af',
    
    // Interactive elements
    buttonBg: isDark ? '#374151' : '#ffffff',
    buttonBgHover: isDark ? '#4b5563' : '#f9fafb',
    buttonBgDisabled: isDark ? '#1f2937' : '#f3f4f6',
    buttonText: isDark ? '#f9fafb' : '#374151',
    buttonTextDisabled: isDark ? '#6b7280' : '#9ca3af',
    
    // Inputs
    inputBg: isDark ? '#111827' : '#ffffff',
    inputBorder: isDark ? '#374151' : '#d1d5db',
    inputText: isDark ? '#f9fafb' : '#1f2937',
    inputPlaceholder: isDark ? '#6b7280' : '#9ca3af',
    
    // Select
    selectBg: isDark ? '#111827' : '#ffffff',
    selectBorder: isDark ? '#374151' : '#d1d5db',
    selectText: isDark ? '#f9fafb' : '#374151',
    selectTextPlaceholder: isDark ? '#9ca3af' : '#4b5563',
    
    // Error states
    errorBg: isDark ? '#7f1d1d' : '#fef2f2',
    errorBorder: isDark ? '#991b1b' : '#fecaca',
    errorText: isDark ? '#fca5a5' : '#991b1b',
    
    // Success/Info
    successBg: '#22c55e',
    infoBg: '#4b6fff',
    warningBg: '#f59e0b',
    
    // Chart colors (same for both themes)
    chartBg: isDark ? '#111827' : '#fafafa',
    chartBorder: isDark ? '#374151' : '#e5e7eb',
    chartLine: '#4b6fff',
    chartBaseline: isDark ? '#4b5563' : '#d1d5db',
    chartText: isDark ? '#f9fafb' : '#111827',
  };
};

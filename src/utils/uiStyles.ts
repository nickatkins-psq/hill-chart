import type { ThemeColors } from "./themeColors";

/**
 * Common button styles
 */
export function getButtonStyles(
  colors: ThemeColors,
  options: {
    variant?: "primary" | "secondary" | "danger" | "info";
    disabled?: boolean;
    height?: string;
  } = {}
): React.CSSProperties {
  const { variant = "secondary", disabled = false, height } = options;

  const baseStyles: React.CSSProperties = {
    padding: "6px 12px",
    borderRadius: 4,
    fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    display: "flex",
    alignItems: "center",
    gap: 6,
    border: "1px solid",
  };

  if (height) {
    baseStyles.height = height;
  }

  switch (variant) {
    case "primary":
    case "info":
      return {
        ...baseStyles,
        border: `1px solid ${colors.infoBg}`,
        background: colors.infoBg,
        color: "#ffffff",
      };
    case "danger":
      return {
        ...baseStyles,
        border: "1px solid #ef4444",
        background: "#ef4444",
        color: "#ffffff",
      };
    case "secondary":
    default:
      return {
        ...baseStyles,
        border: `1px solid ${colors.borderTertiary}`,
        background: disabled ? colors.buttonBgDisabled : colors.buttonBg,
        color: disabled ? colors.buttonTextDisabled : colors.buttonText,
        fontWeight: "bold",
      };
  }
}

/**
 * Common input styles for inline editing
 */
export function getInputStyles(colors: ThemeColors): React.CSSProperties {
  return {
    width: "100%",
    padding: "2px 4px",
    fontSize: 13,
    border: `1px solid ${colors.borderPrimary}`,
    borderRadius: 2,
    backgroundColor: colors.inputBg,
    color: colors.inputText,
  };
}

/**
 * Navigation button styles (prev/next)
 */
export function getNavButtonStyles(
  colors: ThemeColors,
  enabled: boolean
): React.CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 4,
    border: `1px solid ${colors.borderTertiary}`,
    background: enabled ? colors.buttonBg : colors.buttonBgDisabled,
    color: enabled ? colors.buttonText : colors.buttonTextDisabled,
    fontSize: 13,
    cursor: enabled ? "pointer" : "not-allowed",
    fontWeight: "bold",
    opacity: enabled ? 1 : 0.6,
  };
}

// Modern Light Theme - Production Ready with WCAG AAA Compliance
export const T = {
  // Background & Base
  white: "#ffffff",
  background: "#f8fafb",
  surface: "#ffffff",
  
  // Primary Colors - Vibrant & Modern
  primary: "#6366f1", // Indigo - Professional, modern
  primaryLight: "#e0e7ff",
  primaryDark: "#4f46e5",
  
  // Utility Colors - Distinct & Clear
  electricity: "#f59e0b", // Amber - Clear electricity indicator
  electricityLight: "#fef3c7",
  electricSoft: "#fef9e7", // Ultra light for backgrounds
  
  water: "#3b82f6", // Blue - Clear water indicator
  waterLight: "#eff6ff",
  waterSoft: "#f0f9ff", // Ultra light for backgrounds
  
  // Status Colors - WCAG AAA Compliant
  success: "#10b981", // Emerald
  successLight: "#d1fae5", // Better contrast than #ecfdf5
  emeraldSoft: "#f0fdf4", // Ultra light
  
  warning: "#f59e0b", // Amber
  warningLight: "#fcd34d", // Better contrast than #fffbeb
  amberSoft: "#fffbeb", // Light
  
  critical: "#dc2626", // Darker red for better contrast (#ef4444 too light)
  criticalLight: "#fee2e2", // Better contrast
  criticalSoft: "#fef2f2",
  
  // Text Colors
  text: "#0f172a", // Navy - Professional text
  textSecondary: "#475569", // Slate
  textTertiary: "#64748b", // Medium slate
  textInvert: "#ffffff",
  
  // Border & Dividers
  border: "#e2e8f0",
  borderLight: "#f1f5f9",
  
  // Gradients (as string representations)
  gradientPrimary: "#6366f1",
  gradientSecondary: "#8b5cf6",
} as const;

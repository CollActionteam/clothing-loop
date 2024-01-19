const defaultTheme = require("tailwindcss/defaultTheme");

const colors = {
  transparent: "transparent",
  text: "var(--ion-text-color)",
  background: "var(--ion-background-color)",
  primary: {
    DEFAULT: "var(--ion-color-primary)",
    contrast: "var(--ion-color-primary-contrast)",
    shade: "var(--ion-color-primary-shade)",
    tint: "var(--ion-color-primary-tint)",
  },
  secondary: {
    DEFAULT: "var(--ion-color-secondary)",
    contrast: "var(--ion-color-secondary-contrast)",
    shade: "var(--ion-color-secondary-shade)",
    tint: "var(--ion-color-secondary-tint)",
  },
  tertiary: {
    DEFAULT: "var(--ion-color-tertiary)",
    contrast: "var(--ion-color-tertiary-contrast)",
    shade: "var(--ion-color-tertiary-shade)",
    tint: "var(--ion-color-tertiary-tint)",
  },
  success: {
    DEFAULT: "var(--ion-color-success)",
    contrast: "var(--ion-color-success-contrast)",
    shade: "var(--ion-color-success-shade)",
    tint: "var(--ion-color-success-tint)",
  },
  warning: {
    DEFAULT: "var(--ion-color-warning)",
    contrast: "var(--ion-color-warning-contrast)",
    shade: "var(--ion-color-warning-shade)",
    tint: "var(--ion-color-warning-tint)",
  },
  danger: {
    DEFAULT: "var(--ion-color-danger)",
    contrast: "var(--ion-color-danger-contrast)",
    shade: "var(--ion-color-danger-shade)",
    tint: "var(--ion-color-danger-tint)",
  },
  dark: {
    DEFAULT: "var(--ion-color-dark)",
    contrast: "var(--ion-color-dark-contrast)",
    shade: "var(--ion-color-dark-shade)",
    tint: "var(--ion-color-dark-tint)",
  },
  medium: {
    DEFAULT: "var(--ion-color-medium)",
    contrast: "var(--ion-color-medium-contrast)",
    shade: "var(--ion-color-medium-shade)",
    tint: "var(--ion-color-medium-tint)",
  },
  light: {
    DEFAULT: "var(--ion-color-light)",
    contrast: "var(--ion-color-light-contrast)",
    shade: "var(--ion-color-light-shade)",
    tint: "var(--ion-color-light-tint)",
  },
  orange: {
    DEFAULT: "var(--ion-color-orange)",
    contrast: "var(--ion-color-orange-contrast)",
    shade: "var(--ion-color-orange-shade)",
  },
  blue: {
    DEFAULT: "var(--ion-color-blue)",
    contrast: "var(--ion-color-blue-contrast)",
    shade: "var(--ion-color-blue-shade)",
    tint: "var(--ion-color-blue-tint)",
  },
  green: {
    DEFAULT: "var(--ion-color-green)",
    contrast: "var(--ion-color-green-contrast)",
  },
  red: {
    DEFAULT: "var(--ion-color-red)",
    contrast: "var(--ion-color-red-contrast)",
    shade: "var(--ion-color-red-shade)",
  },
  purple: {
    DEFAULT: "var(--ion-color-purple)",
    contrast: "var(--ion-color-purple-contrast)",
    shade: "var(--ion-color-purple-shade)",
  },
};
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  prefix: "tw-",
  preflight: false,
  theme: {
    screens: {
      md: "768px",
    },
    colors,
    fontFamily: {
      sans: ["Montserrat", ...defaultTheme.fontFamily.sans],
      serif: ["Playfair Display", ...defaultTheme.fontFamily.serif],
    },
  },
  plugins: [],
};

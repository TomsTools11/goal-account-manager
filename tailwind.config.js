/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#191919',
          surface: '#202020',
          elevated: '#2F2F2F',
          hover: '#474C50',
          blue: '#407EC9',
          'blue-hover': '#327DA9',
          'blue-secondary': '#1E73BE',
          'blue-light': '#0083BB',
          success: '#448361',
          warning: '#D9730D',
          error: '#D44E49',
          border: '#444B4E',
          form: '#364954',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#EDEEEE',
          muted: '#A7A39A',
          dim: '#55534E',
        },
        goal: {
          blue: '#077BE5',
          dark: '#00172D',
          teal: '#3AEECA',
          accent: '#97C2E8',
          mint: '#9FDACD',
          light: '#F8F9FC',
        }
      },
      fontFamily: {
        display: ['"Red Hat Display"', 'system-ui', 'sans-serif'],
        body: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['"Fira Code"', 'monospace'],
      },
      fontSize: {
        'hero': ['3rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        'h2': ['2.25rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'h3': ['1.75rem', { lineHeight: '1.4', letterSpacing: '-0.01em' }],
        'h4': ['1.5rem', { lineHeight: '1.4' }],
        'h5': ['1.25rem', { lineHeight: '1.5' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        'body': ['1rem', { lineHeight: '1.6' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
        'caption': ['0.75rem', { lineHeight: '1.4' }],
      }
    },
  },
  plugins: [],
};

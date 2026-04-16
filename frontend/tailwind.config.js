/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#627d98',
          400: '#486581',
          500: '#334e68',
          600: '#243b53',
          700: '#1a2f44',
          800: '#102a43',
          900: '#0a1929'
        },
        accent: {
          50: '#fffbea',
          100: '#fff3c4',
          200: '#fce588',
          300: '#fadb5f',
          400: '#f7c948',
          500: '#f0b429',
          600: '#de911d',
          700: '#cb6e17',
          800: '#b44d12',
          900: '#8d2b0b'
        }
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif']
      },
      boxShadow: {
        'card': '0 1px 3px rgba(16, 42, 67, 0.06), 0 1px 2px rgba(16, 42, 67, 0.04)',
        'card-hover': '0 4px 12px rgba(16, 42, 67, 0.08), 0 2px 4px rgba(16, 42, 67, 0.04)',
        'elevated': '0 10px 40px rgba(16, 42, 67, 0.12)',
      }
    }
  },
  plugins: []
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        amplior: {
          blue: '#3B82F6',
          dark: '#0F172A',
          sidebar: '#1E293B',
        }
      }
    }
  },
  plugins: []
}

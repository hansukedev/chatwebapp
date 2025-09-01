/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'messenger-blue': '#0084FF',
        'messenger-gray': '#F0F2F5',
      }
    },
  },
  plugins: [],
}
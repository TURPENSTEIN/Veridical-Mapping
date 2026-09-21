/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
  safelist: [
    {
      pattern: /^(text|bg|border)-(cyan|amber|violet)-(400|500)$/,
    },
    {
      pattern: /^(text|bg|border)-(cyan|amber|violet)-(500\/(10|20|30|40))$/,
    },
    'group-hover:shadow-cyan-500/20',
    'group-hover:shadow-amber-500/20',
    'group-hover:shadow-violet-500/20',
  ],
};

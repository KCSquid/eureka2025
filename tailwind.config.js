/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,tsx}', './components/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter-Regular', 'system-ui', 'sans-serif'],
        serif: ['BricolageGrotesque-Regular', 'Georgia', 'serif'],

        inter: ['Inter-Regular', 'system-ui', 'sans-serif'],
        'inter-thin': ['Inter-Thin', 'system-ui', 'sans-serif'],
        'inter-extralight': ['Inter-ExtraLight', 'system-ui', 'sans-serif'],
        'inter-light': ['Inter-Light', 'system-ui', 'sans-serif'],
        'inter-medium': ['Inter-Medium', 'system-ui', 'sans-serif'],
        'inter-semibold': ['Inter-SemiBold', 'system-ui', 'sans-serif'],
        'inter-bold': ['Inter-Bold', 'system-ui', 'sans-serif'],
        'inter-extrabold': ['Inter-ExtraBold', 'system-ui', 'sans-serif'],
        'inter-black': ['Inter-Black', 'system-ui', 'sans-serif'],

        bricolage: ['BricolageGrotesque-Regular', 'Georgia', 'serif'],
        'bricolage-medium': ['BricolageGrotesque-Medium', 'Georgia', 'serif'],
        'bricolage-semibold': ['BricolageGrotesque-SemiBold', 'Georgia', 'serif'],
        'bricolage-bold': ['BricolageGrotesque-Bold', 'Georgia', 'serif'],
        'bricolage-extrabold': ['BricolageGrotesque-ExtraBold', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

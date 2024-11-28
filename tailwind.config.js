/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#004d00",
          dark: "#003300",
          light: "#66cc66",
        },
      },
      transitionDelay: {
        5000: "5000ms",
      },
      transitionDuration: {
        5000: "5000ms",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

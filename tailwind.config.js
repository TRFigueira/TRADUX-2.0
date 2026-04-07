/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Tema Dark Mode - Paleta inspirada em editores de código
        'cat-dark': {
          900: '#0d1117',  // Fundo principal
          800: '#161b22',  // Painéis secundários
          700: '#21262d',  // Bordas e separadores
          600: '#30363d',  // Elementos hover
          500: '#484f58',  // Texto desativado
          400: '#8b949e',  // Texto secundário
          300: '#c9d1d9',  // Texto primário
          200: '#e6edf3',  // Texto em destaque
          100: '#f0f6fc',  // Texto máximo contraste
        },
        // Cores de destaque para tags protegidas
        'tag-highlight': {
          bg: '#ffd70020',     // Amarelo translúcido
          border: '#ffd700',    // Amarelo
          text: '#ffd700',      // Amarelo
          glow: '#ffd70040'     // Glow suave
        },
        // Cores de estado
        'status': {
          pending: '#f0883e',   // Laranja
          translated: '#3fb950', // Verde
          reviewed: '#58a6ff',  // Azul
          approved: '#a371f7'   // Roxo
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      fontSize: {
        'editor': ['14px', { lineHeight: '1.6' }],
        'sidebar': ['13px', { lineHeight: '1.5' }]
      }
    }
  },
  plugins: []
}

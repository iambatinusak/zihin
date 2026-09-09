export default {
  plugins: {
    // @import ifadeleri Tailwind'den ONCE cozulmeli; aksi halde paylasilan
    // token dosyasindaki @apply/@layer kurallari islenmeden cikti alinir.
    'postcss-import': {},
    tailwindcss: {},
    autoprefixer: {},
  },
}

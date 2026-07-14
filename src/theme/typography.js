import { Colors } from './colors';

export const Typography = {
  h1: { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  body: { fontSize: 15, fontWeight: '600', color: Colors.text },
  label: { fontSize: 13, fontWeight: '700', color: Colors.text },
  caption: { fontSize: 11, fontWeight: '500', color: Colors.textMuted },
};

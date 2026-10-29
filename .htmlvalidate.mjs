import { defineConfig } from 'html-validate';

export default defineConfig({
  extends: ['html-validate:recommended'],
  rules: {
    // The handoff pages style elements inline, and the port keeps that markup (Decision 11).
    'no-inline-style': 'off',
    // The handoff's checkbox label both wraps its input and names it with for=; harmless.
    'no-redundant-for': 'off',
  },
});

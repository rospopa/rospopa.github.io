# React + Vite

The workspace uses the shared green day/night tokens in
`..\resources\palette.css`, imported by `src\index.css`. Keep theme identifiers
`monochrome` and `monochrome-dark` stable: `rep_theme` stores `light` or `dark`.
The login screen and authenticated navigation both provide theme controls;
the selected mode also applies to dialogs and synchronizes across tabs.
Use semantic DaisyUI/Tailwind tokens rather than fixed light-only colors.
The property modal no longer has a Financials tab. Its calculator now lives
on the public static site at `/resources/commercial-property-dcf-calculator/`.
Details, Media, Documents and admin Assign Users remain. Existing financial
values received with a property are preserved on save, not recalculated;
server finance columns and API compatibility have deliberately not been removed.
Calendar category colors and third-party imagery/embeds retain their own
meaning. Validate with `npm run build` and `npm run lint`.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

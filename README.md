# Parse BDEW EBD

Get the Entscheidungsbaumdiagramm Word file (docx) from https://bdew-mako.de and parse it right in the browser.
Planning to use puter features but not yet there.
The parsing itself seems to work for some/most cases.
Tested with “Entscheidungsbaum-Diagramme und Codelisten 4.1 - informatorische Lesefassung - konsolidierte Lesefassung mit Fehlerkorrekturen Stand: 23.06.2025”.

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

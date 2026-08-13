import type { PlopTypes } from "@turbo/gen";

// Learn more about Turborepo Generators at https://turborepo.com/docs/guides/generating-code

/**
 * Turborepo generator that scaffolds a new React component into the internal UI library.
 *
 * - Registers a "react-component" generator with Turborepo.
 * - Prompts the user for the component name.
 * - Creates a new `.tsx` file under `packages/ui/src/` using kebab-case naming.
 * - Automatically appends an export entry for the new component into `packages/ui/package.json`.
 *
 * @param {PlopTypes.NodePlopAPI} plop - The Turborepo/Plop API instance used to register generators.
 */
export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setGenerator("react-component", {
    description: "Adds a new react component",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "What is the name of the component?",
      },
    ],
    actions: [
      {
        type: "add",
        path: "src/{{kebabCase name}}.tsx",
        templateFile: "templates/component.hbs",
      },
      {
        type: "append",
        path: "package.json",
        pattern: /"exports": {(?<insertion>)/g,
        template: '    "./{{kebabCase name}}": "./src/{{kebabCase name}}.tsx",',
      },
    ],
  });
}

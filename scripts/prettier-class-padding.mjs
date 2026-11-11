import { doc } from 'prettier';
import { printers as estreePrinters } from 'prettier/plugins/estree';

const estree = estreePrinters.estree;

// Extend the standard printer so Prettier and the class-spacing lint rule agree.
export const printers = {
  estree: {
    ...estree,
    print(path, ...args) {
      const document = estree.print(path, ...args);
      if (path.node.type !== 'ClassBody' || path.node.body.length === 0) {
        return document;
      }

      if (!Array.isArray(document) || document[0] !== '{') {
        throw new Error('The Prettier class-body printer changed; update the class-padding extension.');
      }

      return ['{', doc.builders.hardline, ...document.slice(1)];
    },
  },
};

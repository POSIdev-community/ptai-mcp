import path from 'node:path';
import { ESLint } from 'eslint';

const eslint = new ESLint({
  overrideConfig: {
    files: ['src/**/*.{ts,js}'],
    rules: {
      'project/function-size': ['warn', { reportAll: true }],
      'project/file-size': ['warn', { reportAll: true }],
    },
  },
});
const results = await eslint.lintFiles(['src/**/*.{ts,js}']);
const functions = results.flatMap((result) =>
  result.messages
    .filter((message) => message.ruleId === 'project/function-size')
    .map((message) => ({
      file: path.relative(process.cwd(), result.filePath),
      line: message.line,
      band: message.messageId,
      description: message.message,
    })),
);

const files = results.flatMap((result) =>
  result.messages
    .filter((message) => message.ruleId === 'project/file-size')
    .map((message) => ({
      file: path.relative(process.cwd(), result.filePath),
      band: message.messageId,
      description: message.message,
    })),
);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ functions, files }, null, 2));
} else {
  for (const band of ['optimal', 'normal', 'acceptable', 'oversized']) {
    console.log(`${band}: ${functions.filter((item) => item.band === band).length}`);
  }
  for (const band of ['optimal', 'normal', 'review', 'oversized', 'exception']) {
    console.log('files ' + band + ': ' + files.filter((item) => item.band === band).length);
  }
  for (const file of files.filter((item) => ['review', 'oversized', 'exception'].includes(item.band))) {
    console.log(file.file + ' ' + file.description);
  }
  for (const item of functions.filter((item) => item.band === 'acceptable' || item.band === 'oversized')) {
    console.log(`${item.file}:${item.line} ${item.description}`);
  }
}
if (functions.some((item) => item.band === 'oversized') || files.some((item) => item.band === 'oversized')) {
  process.exitCode = 1;
}

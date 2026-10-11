// The built page is the desk's web/manor.html, served by %manor.
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir(new URL('../../desk/web/', import.meta.url), {recursive: true});
await copyFile(new URL('../dist/index.html', import.meta.url), new URL('../../desk/web/manor.html', import.meta.url));

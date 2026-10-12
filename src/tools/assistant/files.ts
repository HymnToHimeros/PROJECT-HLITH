/**
 * Files for the Assistant (T71): .json, .md, .txt and .csv go to Claude as text documents, a
 * .pdf as a PDF document. They are read in the browser and sent with your own key for that one
 * message, the same as screenshots; HLITH never stores them.
 */
import type Anthropic from '@anthropic-ai/sdk';

export type DocumentBlock = Anthropic.Beta.BetaRequestDocumentBlock;

export interface PreparedFile {
  name: string;
  kind: 'text' | 'pdf';
  /** Text (text files) or base64 without a data: prefix (PDF). */
  data: string;
  /** Size of the file as picked, in bytes. */
  size: number;
}

export const TEXT_MAX_BYTES = 500 * 1024;
export const PDF_MAX_BYTES = 4 * 1024 * 1024;
/** Per message, screenshots not counted. */
export const FILES_MAX = 5;
export const TEXT_TYPES = ['.json', '.md', '.txt', '.csv'] as const;
/** For the file picker. */
export const FILE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,.json,.md,.markdown,.txt,.csv,.pdf,application/json,text/markdown,text/plain,text/csv,application/pdf';

const ext = (name: string) => {
  const m = /\.[A-Za-z0-9]+$/.exec(name);
  return m ? m[0].toLowerCase() : '';
};
export const isPdf = (f: { name: string; type: string }) => f.type === 'application/pdf' || ext(f.name) === '.pdf';
export const isTextFile = (f: { name: string; type: string }) => [...TEXT_TYPES, '.markdown'].includes(ext(f.name) as (typeof TEXT_TYPES)[number]) || ['application/json', 'text/markdown', 'text/plain', 'text/csv'].includes(f.type);

const kb = (n: number) => `${Math.round(n / 1024)} KB`;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

/** Read a picked file, or say in plain words why it can't be sent. */
export async function prepareFile(file: File): Promise<PreparedFile> {
  const name = file.name.slice(0, 120) || 'file';
  if (isPdf(file)) {
    if (file.size > PDF_MAX_BYTES) throw new Error(`“${name}” is ${mb(file.size)}. A PDF can be up to ${mb(PDF_MAX_BYTES)}.`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) throw new Error(`“${name}” isn’t a PDF the Assistant can read.`);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { name, kind: 'pdf', data: btoa(bin), size: file.size };
  }
  if (isTextFile(file)) {
    if (file.size > TEXT_MAX_BYTES) throw new Error(`“${name}” is ${kb(file.size)}. A text file can be up to ${kb(TEXT_MAX_BYTES)}.`);
    const text = await file.text();
    if (!text.trim()) throw new Error(`“${name}” is empty.`);
    return { name, kind: 'text', data: text, size: file.size };
  }
  throw new Error(`“${name}” can’t be sent. Attach a screenshot, or a .json, .md, .txt, .csv or .pdf file.`);
}

/** The document block Claude reads, titled with the file name. */
export function documentBlock(f: PreparedFile): DocumentBlock {
  return f.kind === 'pdf'
    ? { type: 'document', title: f.name, source: { type: 'base64', media_type: 'application/pdf', data: f.data } }
    : { type: 'document', title: f.name, source: { type: 'text', media_type: 'text/plain', data: f.data } };
}

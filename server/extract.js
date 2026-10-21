// Turns an uploaded file into plain text for the agent.
import path from 'node:path';
import mammoth from 'mammoth';
import { extractText as extractPdfText, getDocumentProxy } from 'unpdf';

export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'];
export const MAX_TEXT_CHARS = 200_000;

export class ExtractionError extends Error {}

export async function extractText({ originalname, buffer }) {
  const ext = path.extname(originalname).toLowerCase();
  let text;

  if (ext === '.pdf') {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      text = (await extractPdfText(pdf, { mergePages: true })).text;
    } catch {
      throw new ExtractionError(`Could not read "${originalname}". The PDF may be corrupted or password-protected.`);
    }
  } else if (ext === '.docx') {
    try {
      text = (await mammoth.extractRawText({ buffer })).value;
    } catch {
      throw new ExtractionError(`Could not read "${originalname}". Make sure it is a valid .docx file.`);
    }
  } else if (ext === '.txt' || ext === '.md') {
    text = buffer.toString('utf8');
  } else {
    throw new ExtractionError(
      `Unsupported file type "${ext || originalname}". Upload a ${ALLOWED_EXTENSIONS.join(', ')} file.`,
    );
  }

  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < 50) {
    throw new ExtractionError(
      `"${originalname}" contains almost no readable text. If it is a scanned PDF, run OCR first or paste the text instead.`,
    );
  }

  let truncated = false;
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS);
    truncated = true;
  }
  return { text, truncated };
}

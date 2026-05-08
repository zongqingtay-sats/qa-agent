import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import path from 'path';

export interface ParsedDocument {
  text: string;
  format: string;
}

export async function parseDocument(buffer: Buffer, filename: string): Promise<ParsedDocument> {
  const ext = path.extname(filename).toLowerCase();

  switch (ext) {
    case '.docx':
      return parseDocx(buffer);
    case '.pdf':
      return parsePdf(buffer);
    case '.txt':
      return parseText(buffer);
    case '.json':
      return parseJson(buffer);
    default:
      // Treat as source code
      return parseText(buffer);
  }
}

async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value, format: 'docx' };
}

async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const data = await pdfParse(buffer);
  return { text: data.text, format: 'pdf' };
}

function parseText(buffer: Buffer): ParsedDocument {
  return { text: buffer.toString('utf-8'), format: 'text' };
}

function parseJson(buffer: Buffer): ParsedDocument {
  const text = buffer.toString('utf-8');
  // Validate it's valid JSON
  JSON.parse(text);
  return { text, format: 'json' };
}

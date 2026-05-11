import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType } from 'docx';
import PDFDocument from 'pdfkit';

interface ExportStepResult {
  stepOrder: number;
  blockType: string;
  description?: string;
  target?: string;
  expectedResult?: string;
  actualResult?: string;
  status: string;
  screenshotDataUrl?: string;
  errorMessage?: string;
  durationMs?: number;
}

interface ExportTestRun {
  testCaseName: string;
  description: string;
  preconditions?: string;
  passingCriteria?: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  environment?: string;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  stepResults: ExportStepResult[];
}

interface ExportTestCase {
  name: string;
  description: string;
  preconditions?: string;
  passingCriteria?: string;
  tags: string[];
  steps: { order: number; action: string; target?: string; value?: string; description: string }[];
}

// ---- JSON Export ----

export function exportTestRunToJson(data: ExportTestRun): string {
  return JSON.stringify(data, null, 2);
}

export function exportTestCaseToJson(data: ExportTestCase): string {
  return JSON.stringify(data, null, 2);
}

// ---- DOCX Export ----

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  try {
    const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (match) {
      return Buffer.from(match[1], 'base64');
    }
  } catch {
    // ignore
  }
  return null;
}

export async function exportTestRunToDocx(data: ExportTestRun): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(new Paragraph({
    children: [new TextRun({ text: `Test Report: ${data.testCaseName}`, bold: true, size: 36 })],
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 200 },
  }));

  // Summary
  children.push(new Paragraph({
    children: [new TextRun({ text: `Status: ${data.status.toUpperCase()}`, bold: true, size: 24, color: data.status === 'passed' ? '22c55e' : 'ef4444' })],
    spacing: { after: 100 },
  }));

  children.push(new Paragraph({ children: [new TextRun({ text: `Date: ${new Date(data.startedAt).toLocaleString()}` })] }));
  if (data.completedAt) {
    children.push(new Paragraph({ children: [new TextRun({ text: `Completed: ${new Date(data.completedAt).toLocaleString()}` })] }));
  }
  if (data.durationMs) {
    children.push(new Paragraph({ children: [new TextRun({ text: `Duration: ${(data.durationMs / 1000).toFixed(1)}s` })] }));
  }
  children.push(new Paragraph({ children: [new TextRun({ text: `Steps: ${data.passedSteps}/${data.totalSteps} passed` })] }));
  if (data.environment) {
    try {
      const env = JSON.parse(data.environment);
      const envParts: string[] = [];
      if (env.browser) envParts.push(`Browser: ${env.browser}`);
      if (env.url) envParts.push(`URL: ${env.url}`);
      if (env.userAgent) envParts.push(`User Agent: ${env.userAgent}`);
      if (envParts.length > 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: `Environment: ${envParts.join(' | ')}` })] }));
      } else {
        children.push(new Paragraph({ children: [new TextRun({ text: `Environment: ${data.environment}` })] }));
      }
    } catch {
      children.push(new Paragraph({ children: [new TextRun({ text: `Environment: ${data.environment}` })] }));
    }
  }

  children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

  // Description
  if (data.description) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Description', bold: true, size: 24 })], heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ children: [new TextRun({ text: data.description })], spacing: { after: 200 } }));
  }

  if (data.passingCriteria) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Passing Criteria', bold: true, size: 24 })], heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ children: [new TextRun({ text: data.passingCriteria })], spacing: { after: 200 } }));
  }

  // Step Results
  children.push(new Paragraph({ children: [new TextRun({ text: 'Step Results', bold: true, size: 24 })], heading: HeadingLevel.HEADING_2, spacing: { after: 200 } }));

  for (const step of data.stepResults) {
    const statusEmoji = step.status === 'passed' ? '✅' : step.status === 'failed' ? '❌' : '⏭️';
    const statusColor = step.status === 'passed' ? '22c55e' : step.status === 'failed' ? 'ef4444' : '94a3b8';

    children.push(new Paragraph({
      children: [
        new TextRun({ text: `Step ${step.stepOrder}: `, bold: true }),
        new TextRun({ text: step.description || step.blockType }),
        new TextRun({ text: ` [${step.status.toUpperCase()}]`, color: statusColor, bold: true }),
      ],
      spacing: { before: 200, after: 100 },
    }));

    if (step.target) {
      children.push(new Paragraph({ children: [new TextRun({ text: `Target: ${step.target}`, italics: true })] }));
    }
    if (step.expectedResult) {
      children.push(new Paragraph({ children: [new TextRun({ text: `Expected: ${step.expectedResult}` })] }));
    }
    if (step.actualResult) {
      children.push(new Paragraph({ children: [new TextRun({ text: `Actual: ${step.actualResult}` })] }));
    }
    if (step.errorMessage) {
      children.push(new Paragraph({ children: [new TextRun({ text: `Error: ${step.errorMessage}`, color: 'ef4444' })] }));
    }
    if (step.durationMs != null) {
      children.push(new Paragraph({ children: [new TextRun({ text: `Duration: ${step.durationMs}ms`, italics: true, color: '6b7280' })] }));
    }

    // Embed screenshot if available
    if (step.screenshotDataUrl) {
      const imgBuffer = dataUrlToBuffer(step.screenshotDataUrl);
      if (imgBuffer) {
        children.push(new Paragraph({
          children: [new ImageRun({ data: imgBuffer, transformation: { width: 560, height: 315 }, type: 'png' })],
          spacing: { after: 200 },
        }));
      }
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Aptos" },
        },
        heading1: {
          run: { font: "Aptos" },
        },
        heading2: {
          run: { font: "Aptos" },
        },
      },
    },
    sections: [{ children }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export async function exportTestCaseToDocx(data: ExportTestCase): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(new Paragraph({
    children: [new TextRun({ text: `Test Case: ${data.name}`, bold: true, size: 36 })],
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 200 },
  }));

  children.push(new Paragraph({ children: [new TextRun({ text: data.description })], spacing: { after: 200 } }));

  if (data.preconditions) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Preconditions', bold: true })], heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ children: [new TextRun({ text: data.preconditions })], spacing: { after: 200 } }));
  }

  if (data.passingCriteria) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Passing Criteria', bold: true })], heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ children: [new TextRun({ text: data.passingCriteria })], spacing: { after: 200 } }));
  }

  children.push(new Paragraph({ children: [new TextRun({ text: 'Test Steps', bold: true })], heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }));

  for (const step of data.steps) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${step.order}. `, bold: true }),
        new TextRun({ text: `[${step.action}] ` }),
        new TextRun({ text: step.description }),
      ],
    }));
    if (step.target) {
      children.push(new Paragraph({ children: [new TextRun({ text: `   Target: ${step.target}`, italics: true })] }));
    }
    if (step.value) {
      children.push(new Paragraph({ children: [new TextRun({ text: `   Value: ${step.value}`, italics: true })] }));
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Aptos" },
        },
        heading1: {
          run: { font: "Aptos" },
        },
        heading2: {
          run: { font: "Aptos" },
        },
      },
    },
    sections: [{ children }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

// ---- PDF Export ----

export function exportTestRunToPdf(data: ExportTestRun): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Title
      doc.fontSize(20).font('Helvetica-Bold').text(`Test Report: ${data.testCaseName}`);
      doc.moveDown(0.5);

      // Status
      const statusColor = data.status === 'passed' ? '#22c55e' : '#ef4444';
      doc.fontSize(14).fillColor(statusColor).text(`Status: ${data.status.toUpperCase()}`);
      doc.fillColor('#000000');
      doc.moveDown(0.3);

      // Summary
      doc.fontSize(10).font('Helvetica');
      doc.text(`Date: ${new Date(data.startedAt).toLocaleString()}`);
      if (data.completedAt) doc.text(`Completed: ${new Date(data.completedAt).toLocaleString()}`);
      if (data.durationMs) doc.text(`Duration: ${(data.durationMs / 1000).toFixed(1)}s`);
      doc.text(`Steps: ${data.passedSteps}/${data.totalSteps} passed`);
      if (data.environment) {
        try {
          const env = JSON.parse(data.environment);
          const envParts: string[] = [];
          if (env.browser) envParts.push(`Browser: ${env.browser}`);
          if (env.url) envParts.push(`URL: ${env.url}`);
          if (env.userAgent) envParts.push(`User Agent: ${env.userAgent}`);
          doc.text(envParts.length > 0 ? `Environment: ${envParts.join(' | ')}` : `Environment: ${data.environment}`);
        } catch {
          doc.text(`Environment: ${data.environment}`);
        }
      }
      doc.moveDown(1);

      // Description
      if (data.description) {
        doc.fontSize(14).font('Helvetica-Bold').text('Description');
        doc.fontSize(10).font('Helvetica').text(data.description);
        doc.moveDown(0.5);
      }

      if (data.passingCriteria) {
        doc.fontSize(14).font('Helvetica-Bold').text('Passing Criteria');
        doc.fontSize(10).font('Helvetica').text(data.passingCriteria);
        doc.moveDown(0.5);
      }

      // Steps
      doc.fontSize(14).font('Helvetica-Bold').text('Step Results');
      doc.moveDown(0.5);

      for (const step of data.stepResults) {
        const stepStatusColor = step.status === 'passed' ? '#22c55e' : step.status === 'failed' ? '#ef4444' : '#94a3b8';

        doc.fontSize(11).font('Helvetica-Bold')
          .fillColor('#000000').text(`Step ${step.stepOrder}: ${step.description || step.blockType}`, { continued: true })
          .fillColor(stepStatusColor).text(` [${step.status.toUpperCase()}]`);

        doc.fillColor('#000000').fontSize(9).font('Helvetica');
        if (step.target) doc.text(`Target: ${step.target}`);
        if (step.expectedResult) doc.text(`Expected: ${step.expectedResult}`);
        if (step.actualResult) doc.text(`Actual: ${step.actualResult}`);
        if (step.errorMessage) doc.fillColor('#ef4444').text(`Error: ${step.errorMessage}`).fillColor('#000000');
        if (step.durationMs != null) doc.fillColor('#6b7280').text(`Duration: ${step.durationMs}ms`).fillColor('#000000');

        // Embed screenshot
        if (step.screenshotDataUrl) {
          const imgBuffer = dataUrlToBuffer(step.screenshotDataUrl);
          if (imgBuffer) {
            try {
              doc.image(imgBuffer, { width: 400 });
            } catch {
              doc.text('[Screenshot could not be embedded]');
            }
          }
        }

        doc.moveDown(0.5);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export function exportTestCaseToPdf(data: ExportTestCase): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(20).font('Helvetica-Bold').text(`Test Case: ${data.name}`);
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(data.description);
      doc.moveDown(1);

      if (data.preconditions) {
        doc.fontSize(14).font('Helvetica-Bold').text('Preconditions');
        doc.fontSize(10).font('Helvetica').text(data.preconditions);
        doc.moveDown(0.5);
      }

      if (data.passingCriteria) {
        doc.fontSize(14).font('Helvetica-Bold').text('Passing Criteria');
        doc.fontSize(10).font('Helvetica').text(data.passingCriteria);
        doc.moveDown(0.5);
      }

      doc.fontSize(14).font('Helvetica-Bold').text('Test Steps');
      doc.moveDown(0.5);

      for (const step of data.steps) {
        doc.fontSize(10).font('Helvetica-Bold').text(`${step.order}. [${step.action}] ${step.description}`);
        doc.font('Helvetica').fontSize(9);
        if (step.target) doc.text(`   Target: ${step.target}`);
        if (step.value) doc.text(`   Value: ${step.value}`);
        doc.moveDown(0.3);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

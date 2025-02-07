import * as fs from 'fs/promises';
import * as fsSync from 'fs'; // Used for creating a writable stream
import * as readline from 'readline';
import PDFDocument from 'pdfkit';

import { deepResearch, writeFinalReport } from './deep-research';
import { generateFeedback } from './feedback';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper function to get user input
function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(query, answer => {
      resolve(answer);
    });
  });
}

/**
 * Generates a nicely formatted academic style PDF.
 * @param report The report text to include in the PDF.
 * @param outputPath The path where the PDF will be saved.
 * @returns A promise that resolves once the PDF is written.
 */
function generatePDF(report: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Create a new PDF document with margins
    const doc = new PDFDocument({ margin: 50 });
    const stream = fsSync.createWriteStream(outputPath);
    doc.pipe(stream);

    // Title page
    doc
      .font('Times-Bold')
      .fontSize(24)
      .text("Final Research Report", { align: 'center' });
    doc.moveDown();
    doc
      .font('Times-Roman')
      .fontSize(12)
      .text(`Date: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.addPage(); // Start a new page for the main content

    // Main content
    doc
      .font('Times-Roman')
      .fontSize(12)
      .text(report, {
        align: 'justify',
        lineGap: 4,
      });

    doc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

// Run the research agent
async function run() {
  // Get the initial query
  const initialQuery = await askQuestion('What would you like to research? ');

  // Get breadth and depth parameters
  const breadth =
    parseInt(await askQuestion('Enter research breadth (recommended 2-10, default 4): '), 10) || 4;
  const depth =
    parseInt(await askQuestion('Enter research depth (recommended 1-5, default 2): '), 10) || 2;

  console.log(`Creating research plan...`);

  // Generate follow-up questions
  const followUpQuestions = await generateFeedback({
    query: initialQuery,
  });

  console.log(
    '\nTo better understand your research needs, please answer these follow-up questions:'
  );

  // Collect answers to the follow-up questions
  const answers: string[] = [];
  for (const question of followUpQuestions) {
    const answer = await askQuestion(`\n${question}\nYour answer: `);
    answers.push(answer);
  }

  // Combine all information for deep research
  const combinedQuery = `
Initial Query: ${initialQuery}
Follow-up Questions and Answers:
${followUpQuestions.map((q, i) => `Q: ${q}\nA: ${answers[i]}`).join('\n')}
`;

  console.log('\nResearching your topic...');

  const { learnings, visitedUrls } = await deepResearch({
    query: combinedQuery,
    breadth,
    depth,
  });

  console.log(`\n\nLearnings:\n\n${learnings.join('\n')}`);
  console.log(`\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`);
  console.log('Writing final report...');

  const report = await writeFinalReport({
    prompt: combinedQuery,
    learnings,
    visitedUrls,
  });

  // Generate PDF from the report
  const outputPdfPath = 'output.pdf';
  await generatePDF(report, outputPdfPath);

  console.log(`\n\nFinal Report PDF generated at: ${outputPdfPath}`);
  rl.close();
}

run().catch(console.error);
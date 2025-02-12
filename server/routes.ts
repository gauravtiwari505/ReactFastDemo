import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import type { FileFilterCallback } from "multer";
import type { Request } from "express";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import { analyzeResume, getResumeAnalysis, saveResumeScore } from "./services/resume_service";

const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'gaurav@metalytics.uk',
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

async function generateAnalysisPDF(analysis: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument();

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Add content to the PDF
    doc.fontSize(24).text('Resume Analysis Report', { align: 'center' });
    doc.moveDown();

    if (analysis.results) {
      // Overview section
      doc.fontSize(18).text('Overview');
      doc.fontSize(12).text(analysis.results.overview);
      doc.moveDown();

      // Overall Score
      doc.fontSize(18).text(`Overall Score: ${analysis.results.overallScore}%`);
      doc.moveDown();

      // Key Strengths
      doc.fontSize(18).text('Key Strengths');
      analysis.results.strengths.forEach((strength: string) => {
        doc.fontSize(12).text(`• ${strength}`);
      });
      doc.moveDown();

      // Areas for Improvement
      doc.fontSize(18).text('Areas for Improvement');
      analysis.results.weaknesses.forEach((weakness: string) => {
        doc.fontSize(12).text(`• ${weakness}`);
      });
      doc.moveDown();

      // Detailed Section Analysis
      doc.fontSize(18).text('Detailed Section Analysis');
      analysis.results.sections.forEach((section: any) => {
        doc.moveDown();
        doc.fontSize(14).text(`${section.name} - Score: ${section.score}%`);
        doc.fontSize(12).text(section.content);
        doc.fontSize(12).text('Suggestions:');
        section.suggestions.forEach((suggestion: string) => {
          doc.text(`• ${suggestion}`);
        });
      });
    }

    doc.end();
  });
}

export function registerRoutes(app: Express): Server {
  app.post("/api/analyze", upload.single("resume"), async (req, res) => {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ message: "No PDF file provided" });
    }

    try {
      // Process the resume using our TypeScript service
      const analysis = await analyzeResume(file.originalname);

      // Store default section scores
      const defaultSections = [
        { name: "Format", score: 80, feedback: "Good formatting" },
        { name: "Content", score: 85, feedback: "Strong content" },
        { name: "Skills", score: 90, feedback: "Relevant skills" }
      ];

      // Save section scores
      for (const section of defaultSections) {
        await saveResumeScore({
          analysisId: analysis.id,
          sectionName: section.name,
          score: section.score,
          feedback: section.feedback
        });
      }

      res.json(analysis);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: "Failed to analyze resume" });
    }
  });

  app.get("/api/analysis/:id", async (req, res) => {
    try {
      const analysis = await getResumeAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }
      res.json(analysis);
    } catch (error) {
      console.error("Error fetching analysis:", error);
      res.status(500).json({ message: "Failed to fetch analysis" });
    }
  });

  app.post("/api/analysis/:id/send-pdf", async (req, res) => {
    try {
      const { email } = req.body;
      const analysis = await getResumeAnalysis(req.params.id);

      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      // Generate PDF
      const pdfBuffer = await generateAnalysisPDF(analysis);

      // Send email with PDF attachment
      await transporter.sendMail({
        from: process.env.GMAIL_USER || 'gaurav@metalytics.uk',
        to: email,
        subject: 'Your Resume Analysis Report',
        text: 'Please find attached your resume analysis report from GigFlick.',
        attachments: [{
          filename: 'resume-analysis.pdf',
          content: pdfBuffer
        }]
      });

      res.json({ message: "PDF sent successfully" });
    } catch (error) {
      console.error("Error sending PDF:", error);
      res.status(500).json({ message: "Failed to send PDF" });
    }
  });

  app.get("/api/analytics", async (_req, res) => {
    try {
      const analytics = await storage.getAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
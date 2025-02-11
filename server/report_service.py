from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from io import BytesIO
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from typing import Dict, List
import os

class ReportGenerator:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.title_style = ParagraphStyle(
            'CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            spaceAfter=30
        )

    def generate_pdf_report(self, analysis_data: Dict) -> BytesIO:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        story = []

        # Title
        story.append(Paragraph("Resume Analysis Report", self.title_style))
        story.append(Spacer(1, 20))

        # Overview
        story.append(Paragraph("Overview", self.styles["Heading2"]))
        story.append(Paragraph(analysis_data["results"]["overview"], self.styles["Normal"]))
        story.append(Spacer(1, 20))

        # Strengths and Weaknesses
        self._add_strengths_weaknesses(story, analysis_data["results"])

        # Section Scores
        self._add_section_scores(story, analysis_data["results"]["sections"])

        # Accessibility Report
        if "accessibility" in analysis_data["results"]:
            self._add_accessibility_report(story, analysis_data["results"]["accessibility"])

        doc.build(story)
        buffer.seek(0)
        return buffer

    def _add_strengths_weaknesses(self, story: List, results: Dict):
        story.append(Paragraph("Strengths", self.styles["Heading2"]))
        for strength in results["strengths"]:
            story.append(Paragraph(f"• {strength}", self.styles["Normal"]))
        story.append(Spacer(1, 10))

        story.append(Paragraph("Areas for Improvement", self.styles["Heading2"]))
        for weakness in results["weaknesses"]:
            story.append(Paragraph(f"• {weakness}", self.styles["Normal"]))
        story.append(Spacer(1, 20))

    def _add_section_scores(self, story: List, sections: List[Dict]):
        story.append(Paragraph("Section Analysis", self.styles["Heading2"]))

        data = [["Section", "Score", "Feedback"]]
        for section in sections:
            data.append([
                section["name"],
                str(section["score"]),
                section["content"]
            ])

        table = Table(data, colWidths=[100, 50, 300])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 12),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))

        story.append(table)
        story.append(Spacer(1, 20))

    def _add_accessibility_report(self, story: List, accessibility: Dict):
        story.append(Paragraph("Accessibility Analysis", self.styles["Heading2"]))
        story.append(Paragraph(f"Accessibility Score: {accessibility['score']}/100", self.styles["Normal"]))
        story.append(Paragraph(accessibility["overallFeedback"], self.styles["Normal"]))
        story.append(Spacer(1, 10))

        if accessibility["issues"]:
            story.append(Paragraph("Identified Issues:", self.styles["Heading3"]))
            for issue in accessibility["issues"]:
                story.append(Paragraph(f"• {issue['description']}", self.styles["Normal"]))
                story.append(Paragraph(f"  Severity: {issue['severity']}", self.styles["Normal"]))
                story.append(Paragraph(f"  Suggestion: {issue['suggestion']}", self.styles["Normal"]))
                story.append(Spacer(1, 5))

class EmailService:
    def __init__(self):
        if not os.getenv("EMAIL_HOST") or not os.getenv("EMAIL_USERNAME") or not os.getenv("EMAIL_PASSWORD"):
            raise ValueError("Email configuration environment variables are missing")

    async def send_analysis_report(self, to_email: str, pdf_data: BytesIO, filename: str):
        msg = MIMEMultipart()
        msg['From'] = os.getenv("EMAIL_USERNAME")
        msg['To'] = to_email
        msg['Subject'] = "Your Resume Analysis Report"

        body = """
        Thank you for using our Resume Analysis service!

        Please find attached your detailed resume analysis report. This report includes:
        - Overall assessment
        - Section-by-section analysis
        - Strengths and areas for improvement
        - Accessibility evaluation
        - Specific recommendations

        If you have any questions about your report, please don't hesitate to reach out.
        """

        msg.attach(MIMEText(body, 'plain'))

        pdf_attachment = MIMEApplication(pdf_data.getvalue(), _subtype='pdf')
        pdf_attachment.add_header('Content-Disposition', 'attachment', filename=f"{filename}_analysis.pdf")
        msg.attach(pdf_attachment)

        with smtplib.SMTP(os.getenv("EMAIL_HOST"), 587) as server:
            server.starttls()
            server.login(os.getenv("EMAIL_USERNAME"), os.getenv("EMAIL_PASSWORD"))
            server.send_message(msg)
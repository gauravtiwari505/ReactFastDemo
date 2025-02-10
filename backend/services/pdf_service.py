import pdfkit

def generate_pdf(document_id: str, analysis_results):
    """
    Generate a PDF file containing the resume analysis results.

    Args:
        document_id (str): ID of the analyzed document.
        analysis_results: The analysis results to include in the PDF.

    Returns:
        str: Path to the generated PDF file.
    """
    # Construct HTML content for the PDF using analysis results
    html_content = f"""
    <h1>Resume Analysis Report</h1>
    <h2>Contact Information</h2>
    <p>Name: {analysis_results.contact_info.candidate_name}</p>
    <p>Email: {analysis_results.contact_info.candidate_email}</p>
    <h2>Summary Evaluation</h2>
    <p>Summary: {analysis_results.summary.CV_summary}</p>
    <p>Score: {analysis_results.summary.score_summary}</p>
    """

    # Generate PDF and save to file
    pdf_file = f"./static/reports/resume_analysis_{document_id}.pdf"
    pdfkit.from_string(html_content, pdf_file)

    return pdf_file

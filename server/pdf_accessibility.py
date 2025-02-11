import pdfplumber
import base64
from typing import Dict, List, Optional

class AccessibilityChecker:
    def __init__(self, file_bytes: bytes):
        self.pdf = pdfplumber.open(file_bytes)
        
    def check_accessibility(self) -> Dict:
        issues = []
        total_score = 100  # Start with perfect score
        
        # Check text extraction
        if not self._check_text_extractable():
            issues.append({
                "type": "text_extraction",
                "description": "Text cannot be properly extracted from the PDF",
                "severity": "high",
                "suggestion": "Ensure the PDF is not scanned or contains proper text layers"
            })
            total_score -= 30
            
        # Check image accessibility
        img_issues = self._check_images()
        if img_issues:
            issues.extend(img_issues)
            total_score -= len(img_issues) * 10
            
        # Check document structure
        struct_issues = self._check_structure()
        if struct_issues:
            issues.extend(struct_issues)
            total_score -= len(struct_issues) * 5
            
        # Ensure score doesn't go below 0
        total_score = max(0, total_score)
        
        return {
            "score": total_score,
            "issues": issues,
            "overallFeedback": self._generate_feedback(total_score, issues)
        }
    
    def _check_text_extractable(self) -> bool:
        """Check if text can be extracted from the PDF"""
        try:
            text_content = []
            for page in self.pdf.pages:
                text = page.extract_text()
                if text:
                    text_content.append(text)
            return len(text_content) > 0
        except Exception:
            return False
    
    def _check_images(self) -> List[Dict]:
        """Check image accessibility"""
        issues = []
        for page in self.pdf.pages:
            if page.images:
                issues.append({
                    "type": "images",
                    "description": "PDF contains images that may need alt text",
                    "severity": "medium",
                    "suggestion": "Add alt text descriptions for all images"
                })
                break
        return issues
    
    def _check_structure(self) -> List[Dict]:
        """Check document structure accessibility"""
        issues = []
        
        # Check for potential headings
        for page in self.pdf.pages:
            text = page.extract_text()
            if text and not any(line.strip().isupper() for line in text.split('\n')):
                issues.append({
                    "type": "structure",
                    "description": "Document may lack clear headings",
                    "severity": "medium",
                    "suggestion": "Use clear heading structure to organize content"
                })
                break
        
        return issues
    
    def _generate_feedback(self, score: int, issues: List[Dict]) -> str:
        """Generate overall feedback based on score and issues"""
        if score >= 90:
            return "This PDF is highly accessible with minor improvements possible."
        elif score >= 70:
            return "The PDF is moderately accessible but could benefit from some improvements."
        elif score >= 50:
            return "The PDF has several accessibility issues that should be addressed."
        else:
            return "The PDF has significant accessibility issues that need immediate attention."
            
    def close(self):
        """Close the PDF file"""
        self.pdf.close()

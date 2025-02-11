'):
                response_text = response_text[7:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]

            # Parse and validate JSON
            result = json.loads(response_text)

            # Normalize the response
            result["score"] = max(0, min(100, int(float(result.get("score", 50)))))
            result["content"] = str(result.get("content", "Content analysis not available"))
            result["suggestions"] = result.get("suggestions", [])

            # Ensure exactly 3 suggestions
            while len(result["suggestions"]) < 3:
                result["suggestions"].append("Review this section for improvements")
            result["suggestions"] = result["suggestions"][:3]

            return result

        except Exception as e:
            log_error(f"Analysis attempt {attempt + 1} failed: {str(e)}")
            if attempt == max_retries - 1:
                return get_default_section_result()
            time.sleep(1)  # Wait before retry

def analyze_resume(file_bytes: bytes) -> Dict[str, Any]:
    """Process and analyze a resume"""
    try:
        text = extract_text_from_pdf(file_bytes)
        log_info(f"Extracted {len(text)} characters from PDF")

        sections = ["Professional Summary", "Work Experience", "Skills", "Education"]
        section_results = []

        for section in sections:
            result = analyze_section(text, section)
            section_results.append({"name": section, **result})
            time.sleep(1)  # Delay between sections

        overall_score = sum(section["score"] for section in section_results) // len(section_results) if section_results else 0

        overview_prompt = f"""Analyze this resume and provide a brief evaluation.
Respond ONLY with a JSON object in this format, no other text:
{{
    "overview": "<brief professional evaluation>",
    "strengths": [
        "<strength 1>",
        "<strength 2>",
        "<strength 3>"
    ],
    "weaknesses": [
        "<weakness 1>",
        "<weakness 2>",
        "<weakness 3>"
    ]
}}

Resume text: {text}"""

        overview_response = model.generate_content(overview_prompt)
        overview_text = overview_response.text.strip()
        if overview_text.startswith('```json'):
            overview_text = overview_text[7:]
        if overview_text.endswith('
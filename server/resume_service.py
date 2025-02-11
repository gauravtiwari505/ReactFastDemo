'):
                response_text = response_text[7:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]

            # Parse the JSON
            result = json.loads(response_text)

            # Validate the response structure
            if not isinstance(result.get("score"), (int, float)):
                result["score"] = 50
            if not isinstance(result.get("content"), str):
                result["content"] = "Content analysis not available"
            if not isinstance(result.get("suggestions"), list):
                result["suggestions"] = []

            # Ensure score is in valid range
            result["score"] = max(0, min(100, int(result["score"])))

            # Ensure exactly 3 suggestions
            while len(result["suggestions"]) < 3:
                result["suggestions"].append("Review this section for potential improvements")
            result["suggestions"] = result["suggestions"][:3]

            return result

        except Exception as e:
            log_error(f"Attempt {attempt + 1} failed: {str(e)}")
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

        # Generate overview with simpler prompt
        overview_prompt = f"""Provide a resume overview in this exact JSON format only:
{{
    "overview": [2-3 sentence evaluation],
    "strengths": [
        [key strength 1],
        [key strength 2],
        [key strength 3]
    ],
    "weaknesses": [
        [improvement area 1],
        [improvement area 2],
        [improvement area 3]
    ]
}}

Resume text: {text}"""

        overview_response = model.generate_content(overview_prompt)
        overview_text = overview_response.text.strip()
        if overview_text.startswith('```json'):
            overview_text = overview_text[7:]
        if overview_text.endswith('
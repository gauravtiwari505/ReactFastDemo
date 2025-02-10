from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from app_constants import templates  # Import the templates correctly
from config import OPENAI_API_KEY, GOOGLE_API_KEY

def instantiate_llm(provider, temperature=0.5, top_p=0.95, model_name=None):
    """
    Instantiate LLM based on the provider (OpenAI or Google Generative AI).
    """
    if provider == "OpenAI":
        return ChatOpenAI(
            api_key=OPENAI_API_KEY,
            model=model_name,
            temperature=temperature,
            model_kwargs={"top_p": top_p},
        )
    elif provider == "Google":
        return ChatGoogleGenerativeAI(
            google_api_key=GOOGLE_API_KEY,
            model=model_name,
            temperature=temperature,
            top_p=top_p,
            convert_system_message_to_human=True,
        )
    else:
        raise ValueError("Unsupported LLM provider. Supported providers: OpenAI, Google.")

def invoke_llm(llm, resume_text, template_key):
    """
    Invoke the LLM using the specified prompt template.

    Args:
        llm: The instantiated LLM object (OpenAI or Google).
        resume_text: The input text (resume content).
        template_key: The key to retrieve the correct prompt template.

    Returns:
        LLM response content.
    """
    # Access the correct prompt template from app_constants
    prompt = templates[template_key].format(text=resume_text)
    response = llm.invoke(prompt)
    return response.content

from tools.definitions import tool
from pypdf import PdfReader
from fpdf import FPDF

@tool(
    name="extract_pdf_text",
    description="Extract all text from a PDF file at the given path.",
    parameters={
        "type": "object",
        "properties": {
            "file_path": {
                "type": "string",
                "description": "Path to the PDF file"
            }
        },
        "required": ["file_path"]
    }
)
def extract_pdf_text(file_path: str):
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    return {"text": text, "pages": len(reader.pages)}

@tool(
    name="create_pdf",
    description="Create a PDF file with the given text content.",
    parameters={
        "type": "object",
        "properties": {
            "text": {
                "type": "string",
                "description": "Text content to put in the PDF"
            },
            "output_path": {
                "type": "string",
                "description": "Where to save the PDF file"
            },
            "title": {
                "type": "string",
                "description": "PDF title (optional)",
                "default": ""
            }
        },
        "required": ["text", "output_path"]
    }
)
def create_pdf(text: str, output_path: str, title: str = ""):
    pdf = FPDF()
    pdf.add_page()
    if title:
        pdf.set_font("Helvetica", size=16)
        pdf.cell(200, 10, text=title, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(10)
    pdf.set_font("Helvetica", size=12)
    for line in text.split("\n"):
        pdf.cell(200, 10, text=line[:80], new_x="LMARGIN", new_y="NEXT")
    pdf.output(output_path)
    return {"status": "created", "path": output_path}

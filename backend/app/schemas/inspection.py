from pydantic import BaseModel


class OCRResultPage(BaseModel):
    page_number: int
    text: str
    images: dict[str, str] = {}


class OCRResponse(BaseModel):
    success: bool
    pages: list[OCRResultPage] = []
    raw_text: str = ""
    error: str | None = None

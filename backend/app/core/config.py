from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    paddleocr_token: str = ""
    paddleocr_model: str = "PaddleOCR-VL-1.6"
    database_url: str = "mysql+asyncmy://user:pass@localhost/inspection_db"

    class Config:
        env_file = ".env"


settings = Settings()

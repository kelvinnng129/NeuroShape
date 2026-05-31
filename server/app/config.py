from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    CORS_ORIGIN: str = "http://localhost:3000"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    TEMP_DIR: str = "./temp_uploads"
    MODEL_CACHE_DIR: str = "./models_cache"

    class Config:
        env_file = ".env"


settings = Settings()
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Gemelo Digital Urbano de Salud — Trujillo"
    VERSION: str = "1.0.0-academic"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://admin:password@localhost:5432/health_twin_db")
    DEBUG: bool = True
    
    # Priority Risk Thresholds
    THRESHOLD_BAJO: float = 0.39
    THRESHOLD_MEDIO: float = 0.59
    THRESHOLD_ALTO: float = 0.79
    THRESHOLD_CRITICO: float = 1.00

settings = Settings()

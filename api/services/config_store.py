import json
from pathlib import Path

from api.schemas.requests import AppConfig


class ConfigStore:
    def __init__(self) -> None:
        self._path = Path(__file__).resolve().parent.parent / "data" / "config.json"

    def load(self) -> AppConfig:
        return AppConfig.model_validate(json.loads(self._path.read_text()))

    def save(self, config: AppConfig) -> AppConfig:
        self._path.write_text(json.dumps(config.model_dump(), indent=2))
        return config

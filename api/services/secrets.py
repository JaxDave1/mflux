import os
import stat
from pathlib import Path


SUPPORTED_SECRET_KEYS = {"hf": "MFLUX_HF_TOKEN", "civitai": "MFLUX_CIVITAI_TOKEN"}


class SecretsManager:
    def __init__(self) -> None:
        self._dir = Path.home() / "Library" / "Application Support" / "MFLUX-NeuralInterface"
        self._path = self._dir / "secrets.env"
        self._ensure_dir()
        self._load_into_env()

    @property
    def path(self) -> Path:
        return self._path

    @property
    def directory(self) -> Path:
        return self._dir

    def get(self, key: str) -> str | None:
        env_key = self._env_key(key)
        return self._read().get(env_key)

    def set(self, key: str, value: str) -> None:
        env_key = self._env_key(key)
        data = self._read()
        data[env_key] = value.strip()
        self._write(data)
        os.environ[env_key] = data[env_key]

    def clear(self, key: str) -> None:
        env_key = self._env_key(key)
        data = self._read()
        data.pop(env_key, None)
        self._write(data)
        os.environ.pop(env_key, None)

    def list_keys(self) -> list[str]:
        data = self._read()
        return [key for key, env_key in SUPPORTED_SECRET_KEYS.items() if env_key in data and bool(data[env_key])]

    def is_set(self, key: str) -> bool:
        value = self.get(key)
        return value is not None and value != ""

    def _env_key(self, key: str) -> str:
        if key not in SUPPORTED_SECRET_KEYS:
            raise KeyError(key)
        return SUPPORTED_SECRET_KEYS[key]

    def _ensure_dir(self) -> None:
        self._dir.mkdir(parents=True, exist_ok=True)
        self._dir.chmod(0o700)

    def _load_into_env(self) -> None:
        for key, value in self._read().items():
            os.environ[key] = value

    def _read(self) -> dict[str, str]:
        if not self._path.exists():
            return {}
        data: dict[str, str] = {}
        for line in self._path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            if key in SUPPORTED_SECRET_KEYS.values():
                data[key] = value
        return data

    def _write(self, data: dict[str, str]) -> None:
        self._ensure_dir()
        lines = [f"{key}={value}" for key, value in data.items() if key in SUPPORTED_SECRET_KEYS.values() and value]
        flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
        fd = os.open(self._path, flags, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write("\n".join(lines))
            if lines:
                handle.write("\n")
        self._path.chmod(0o600)
        self._verify_permissions()

    def _verify_permissions(self) -> None:
        dir_mode = stat.S_IMODE(self._dir.stat().st_mode)
        file_mode = stat.S_IMODE(self._path.stat().st_mode)
        if dir_mode != 0o700:
            raise PermissionError(f"Secrets directory must be 0700, found {oct(dir_mode)}")
        if file_mode != 0o600:
            raise PermissionError(f"Secrets file must be 0600, found {oct(file_mode)}")


secrets_manager = SecretsManager()

"""Encryption service for protecting sensitive credentials."""

from cryptography.fernet import Fernet
from core.config import settings


class EncryptionService:
    def __init__(self):
        self.key = settings.ENCRYPTION_KEY
        if not self.key:
            raise ValueError("ENCRYPTION_KEY is not set in environment variables")
        self.fernet = Fernet(self.key)

    def encrypt(self, data: str) -> str:
        """Encrypts a string and returns a base64 encoded string."""
        if not data:
            return ""
        return self.fernet.encrypt(data.encode()).decode()

    def decrypt(self, token: str) -> str:
        """Decrypts a base64 encoded string and returns the original string."""
        if not token:
            return ""
        return self.fernet.decrypt(token.encode()).decode()


encryption_service = EncryptionService()

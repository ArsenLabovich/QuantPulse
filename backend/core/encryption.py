from cryptography.fernet import Fernet
from core.config import settings
import json


def get_encryption_key() -> bytes:
    """Get encryption key from settings or generate one for development."""
    encryption_key = settings.ENCRYPTION_KEY
    if not encryption_key:
        # For development: generate a key if not set
        # In production, this should always be set via environment variable
        key = Fernet.generate_key()
        encryption_key = key.decode()
    return encryption_key.encode() if isinstance(encryption_key, str) else encryption_key


def encrypt_data(data: str) -> str:
    """Encrypt a string using Fernet symmetric encryption."""
    key = get_encryption_key()
    f = Fernet(key)
    encrypted_data = f.encrypt(data.encode('utf-8'))
    return encrypted_data.decode('utf-8')


def decrypt_data(encrypted_data: str) -> str:
    """Decrypt a string using Fernet symmetric encryption."""
    key = get_encryption_key()
    f = Fernet(key)
    decrypted_data = f.decrypt(encrypted_data.encode('utf-8'))
    return decrypted_data.decode('utf-8')


def encrypt_json(data: dict) -> str:
    """Encrypt a dictionary as JSON string."""
    json_str = json.dumps(data)
    return encrypt_data(json_str)


def decrypt_json(encrypted_data: str) -> dict:
    """Decrypt and parse JSON string to dictionary."""
    json_str = decrypt_data(encrypted_data)
    return json.loads(json_str)

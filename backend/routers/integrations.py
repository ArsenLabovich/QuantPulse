from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.integration import Integration, ProviderID
from schemas.integration import IntegrationCreate, IntegrationResponse, IntegrationUpdate
from core.encryption import encrypt_json, decrypt_json
from adapters.binance_adapter import BinanceAdapter
import json

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])


def get_adapter(provider_id: ProviderID):
    """Factory function to get the appropriate adapter for a provider."""
    if provider_id == ProviderID.BINANCE:
        return BinanceAdapter()
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Provider {provider_id} is not yet supported"
        )


@router.get("", response_model=List[IntegrationResponse])
async def get_integrations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all integrations for the current user."""
    result = await db.execute(
        select(Integration).filter(Integration.user_id == current_user.id)
    )
    integrations = result.scalars().all()
    
    # Convert to response models (credentials are not included)
    return [IntegrationResponse.model_validate(integration) for integration in integrations]


@router.post("/{provider_id}", response_model=IntegrationResponse)
async def create_integration(
    provider_id: ProviderID,
    integration_data: IntegrationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new integration using the adapter pattern."""
    # Validate provider_id matches
    if integration_data.provider_id != provider_id:
        raise HTTPException(
            status_code=400,
            detail="Provider ID in URL and body must match"
        )
    
    # Get the appropriate adapter
    adapter = get_adapter(provider_id)
    
    # Validate credentials using the adapter
    try:
        await adapter.validate(integration_data.credentials)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Validation failed: {str(e)}"
        )
    
    # Encrypt credentials before storage
    encrypted_credentials = encrypt_json(integration_data.credentials)
    
    # Check if integration with same name already exists for this user
    result = await db.execute(
        select(Integration).filter(
            Integration.user_id == current_user.id,
            Integration.name == integration_data.name
        )
    )
    existing = result.scalars().first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Integration with this name already exists"
        )
    
    # Create the integration
    db_integration = Integration(
        user_id=current_user.id,
        provider_id=integration_data.provider_id,
        name=integration_data.name,
        credentials=encrypted_credentials,
        is_active=True,
        settings=integration_data.settings
    )
    
    db.add(db_integration)
    await db.commit()
    await db.refresh(db_integration)
    
    return IntegrationResponse.model_validate(db_integration)


@router.get("/{integration_id}", response_model=IntegrationResponse)
async def get_integration(
    integration_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific integration by ID."""
    from uuid import UUID
    
    try:
        integration_uuid = UUID(integration_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid integration ID")
    
    result = await db.execute(
        select(Integration).filter(
            Integration.id == integration_uuid,
            Integration.user_id == current_user.id
        )
    )
    integration = result.scalars().first()
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    return IntegrationResponse.model_validate(integration)

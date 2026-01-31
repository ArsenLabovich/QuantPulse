from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List
from uuid import UUID
import ccxt
import json

from core.database import get_db
from core.security.encryption import encryption_service
from core.deps import get_current_user
from models.integration import Integration, ProviderID
from models.user import User
from models.assets import UnifiedAsset
from schemas.integration import IntegrationCreate, IntegrationResponse
from worker.tasks import sync_integration_data

router = APIRouter()

@router.get("/", response_model=List[IntegrationResponse])
async def get_integrations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Integration).where(Integration.user_id == current_user.id)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=IntegrationResponse)
async def create_integration(
    integration_in: IntegrationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 0. Check for duplicates
    query = select(Integration).where(Integration.user_id == current_user.id)
    result = await db.execute(query)
    existing_integrations = result.scalars().all()

    new_api_key = integration_in.credentials.get("api_key")
    if new_api_key:
        for existing in existing_integrations:
            try:
                # Decrypt stored credentials
                decrypted_json = encryption_service.decrypt(existing.credentials)
                existing_creds = json.loads(decrypted_json)
                
                # Compare API Keys
                if existing_creds.get("api_key") == new_api_key:
                     raise HTTPException(
                        status_code=400, 
                        detail=f"This API Key is already added as '{existing.name}'. Duplicate keys are not allowed."
                    )
            except Exception:
                # If decryption fails for old/corrupt data, skip it safely
                continue

    # 1. Use Adapter to Validate
    from adapters.factory import AdapterFactory
    try:
        adapter = AdapterFactory.get_adapter(integration_in.provider_id)
        is_valid = await adapter.validate_credentials(
            integration_in.credentials, 
            integration_in.settings
        )
        if not is_valid:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid credentials for {integration_in.provider_id.value}"
            )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")

    # 3. Encrypt Credentials
    encrypted_credentials = encryption_service.encrypt(json.dumps(integration_in.credentials))

    # 4. Save
    new_integration = Integration(
        user_id=current_user.id,
        provider_id=integration_in.provider_id,
        name=integration_in.name,
        credentials=encrypted_credentials,
        settings=integration_in.settings,
        is_active=True
    )
    db.add(new_integration)
    await db.commit()
    await db.refresh(new_integration)
    
    # Trigger background sync
    try:
        sync_integration_data.delay(str(new_integration.id))
    except Exception as e:
        # Don't fail the request if worker trigger fails, just log it
        print(f"Failed to trigger sync task: {e}")
        
    return new_integration

@router.delete("/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_integration(
    integration_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Integration).where(
        Integration.id == integration_id,
        Integration.user_id == current_user.id
    )
    result = await db.execute(query)
    integration = result.scalar_one_or_none()
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
        
    # Delete associated assets first (Cascade manually)
    await db.execute(delete(UnifiedAsset).where(UnifiedAsset.integration_id == integration.id))

    await db.delete(integration)
    await db.commit()

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

    # 1. Validate Provider
    if integration_in.provider_id == ProviderID.binance:
        api_key = integration_in.credentials.get("api_key")
        api_secret = integration_in.credentials.get("api_secret")
        
        if not api_key or not api_secret:
             raise HTTPException(status_code=400, detail="Missing API Key or Secret")

        # 2. CCXT Validation
        try:
            exchange = ccxt.binance({
                'apiKey': api_key,
                'secret': api_secret,
                'enableRateLimit': True,
            })
            # Lightweight check
            exchange.fetch_balance()
            
            try:
                # This is specific to Binance
                response = exchange.sapi_get_account_api_restrictions()
                if response.get('enableWithdrawals'):
                     raise HTTPException(
                        status_code=400, 
                        detail="Security Alert: This API Key has 'Enable Withdrawals' checked. Please disable it in Binance settings."
                    )
            except Exception as e:
                if "Security Alert" in str(e):
                    raise e

        except ccxt.AuthenticationError:
             raise HTTPException(status_code=400, detail="Invalid API Credentials")
        except Exception as e:
             raise HTTPException(status_code=400, detail=f"Connection Failed: {str(e)}")
             
    elif integration_in.provider_id == ProviderID.trading212:
        api_key = integration_in.credentials.get("api_key")
        
        if not api_key:
             raise HTTPException(status_code=400, detail="Missing API Key")

        api_secret = integration_in.credentials.get("api_secret")
        
        # Trading 212 Validation
        try:
            from services.trading212 import Trading212Client
            print(f"DEBUG: Validating T212 Key: {api_key[:5]}... Secret: {'Provided' if api_secret else 'None'}")
            
            client = Trading212Client(api_key=api_key, api_secret=api_secret)
            validation_result = await client.validate_keys()
            
            print(f"DEBUG: T212 Validation Result: {validation_result}")
            
            if not validation_result.get("valid"):
                raise HTTPException(status_code=400, detail="Invalid API Key. Authentication failed.")
            
            # Save is_demo flag to settings
            if validation_result.get("is_demo"):
                integration_settings["is_demo"] = True
                
        except HTTPException as e:
            raise e
        except Exception as e:
            print(f"DEBUG: T212 Exception: {e}")
            raise HTTPException(status_code=400, detail=f"Connection Failed: {str(e)}")

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

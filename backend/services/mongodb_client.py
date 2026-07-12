from __future__ import annotations
import os
import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

logger = logging.getLogger("mcp_gateway.mongodb")

class MongoDBClient:
    """Singleton MongoDB client for motor."""
    _client: Optional[AsyncIOMotorClient] = None
    _db: Optional[AsyncIOMotorDatabase] = None

    @classmethod
    async def connect(cls):
        """Initialize MongoDB connection."""
        uri = os.getenv("MONGODB_URI")
        db_name = os.getenv("MONGODB_DB_NAME", "mcp_gateway")

        if not uri:
            logger.warning("MONGODB_URI not found in environment. MongoDB features will be disabled.")
            return

        try:
            cls._client = AsyncIOMotorClient(uri)
            cls._db = cls._client[db_name]
            # Ping database to verify connection
            await cls._client.admin.command('ping')
            logger.info(f"✅ Connected to MongoDB Atlas (Database: {db_name})")
        except Exception as e:
            logger.error(f"❌ Failed to connect to MongoDB: {e}")
            cls._client = None
            cls._db = None

    @classmethod
    async def close(cls):
        """Close MongoDB connection."""
        if cls._client is not None:
            cls._client.close()
            logger.info("MongoDB connection closed.")

    @classmethod
    def get_db(cls) -> Optional[AsyncIOMotorDatabase]:
        """Get the active database instance."""
        return cls._db

    @classmethod
    def is_connected(cls) -> bool:
        """Check if connected to MongoDB."""
        return cls._db is not None

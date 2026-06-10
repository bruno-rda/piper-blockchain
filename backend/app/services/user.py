from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import select

from app.crypto import hash_password, verify_password
from app.models.orm import User


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user(self, username: str) -> User:
        result = await self.db.execute(
            select(User).filter(User.username == username).limit(1)
        )
        user = result.scalars().first()
        if not user:
            raise ValueError("User not found")

        return user

    async def create_user(self, username: str, password: str) -> str:
        user = User(username=username, password_hash=hash_password(password))
        self.db.add(user)
        await self.db.commit()
        return user.id

    async def authenticate_user(self, username: str, password: str) -> str:
        result = await self.db.execute(
            select(User).filter(User.username == username).limit(1)
        )
        user = result.scalars().first()
        if not user:
            raise ValueError("Username or password is incorrect")

        if not verify_password(password, user.password_hash):
            raise ValueError("Username or password is incorrect")

        return user.id

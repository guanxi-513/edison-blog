from sqlmodel import SQLModel, create_engine, Session
from app.config import DATABASE_URL

# SQLite 需要关闭同线程检查（FastAPI 多线程访问）；PostgreSQL 用连接池
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True, connect_args=_connect_args)


def init_db():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session

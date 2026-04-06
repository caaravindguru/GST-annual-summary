from sqlalchemy import create_engine, Column, Integer, String, Float, Date, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

SQLALCHEMY_DATABASE_URL = "sqlite:///./gst_reconcile.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    invoices = relationship("Invoice", back_populates="client")
    turnovers = relationship("MonthlyTurnover", back_populates="client")

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"))
    month = Column(String)
    particular = Column(String)
    gstin = Column(String)
    trade_name = Column(String)
    invoice_number = Column(String)
    invoice_date = Column(Date)
    rate = Column(Float, default=0.0)
    taxable_value = Column(Float, default=0.0)
    igst = Column(Float, default=0.0)
    cgst = Column(Float, default=0.0)
    sgst = Column(Float, default=0.0)
    status = Column(String, default='Unknown')
    sub_status = Column(String, nullable=True)
    is_common_itc = Column(Boolean, default=False)
    client = relationship("Client", back_populates="invoices")

class MonthlyTurnover(Base):
    __tablename__ = "monthly_turnovers"
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"))
    month = Column(String)
    nil_rated_turnover = Column(Float, default=0.0)
    exempt_turnover = Column(Float, default=0.0)
    total_turnover = Column(Float, default=0.0)
    client = relationship("Client", back_populates="turnovers")

Base.metadata.create_all(bind=engine)

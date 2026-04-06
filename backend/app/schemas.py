from pydantic import BaseModel
from typing import List, Optional, Union
from datetime import date

class ClientBase(BaseModel):
    name: str

class ClientCreate(ClientBase):
    pass

class Client(ClientBase):
    id: int
    class Config:
        from_attributes = True

class InvoiceBase(BaseModel):
    month: Optional[str]
    particular: Optional[str]
    gstin: Optional[str]
    trade_name: Optional[str]
    invoice_number: Optional[str]
    invoice_date: Optional[date]
    rate: Optional[float]
    taxable_value: Optional[float]
    igst: Optional[float]
    cgst: Optional[float]
    sgst: Optional[float]
    status: Optional[str]
    sub_status: Optional[str]
    is_common_itc: Optional[bool]

class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    sub_status: Optional[str] = None
    is_common_itc: Optional[bool] = None

class Invoice(InvoiceBase):
    id: int
    client_id: int
    class Config:
        from_attributes = True

class TurnoverBase(BaseModel):
    month: str
    nil_rated_turnover: float
    exempt_turnover: float
    total_turnover: float

class TurnoverCreate(TurnoverBase):
    pass

class Turnover(TurnoverBase):
    id: int
    client_id: int
    class Config:
        from_attributes = True

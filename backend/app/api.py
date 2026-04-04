from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from . import models, schemas, logic
from .models import SessionLocal
from typing import List

router = APIRouter()
def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

@router.get("/clients", response_model=List[schemas.Client])
def get_clients(db: Session = Depends(get_db)): return db.query(models.Client).all()

@router.post("/clients", response_model=schemas.Client)
def create_client(client: schemas.ClientCreate, db: Session = Depends(get_db)):
    db_client = models.Client(name=client.name)
    db.add(db_client); db.commit(); db.refresh(db_client)
    return db_client

@router.post("/clients/{client_id}/upload")
async def upload(client_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        invoices = logic.parse_excel(await file.read(), client_id)
        db.add_all(invoices); db.commit()
        return {"message": "Success"}
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))

@router.get("/clients/{client_id}/invoices", response_model=List[schemas.Invoice])
def get_invoices(client_id: int, db: Session = Depends(get_db)):
    return db.query(models.Invoice).filter(models.Invoice.client_id == client_id).all()

@router.patch("/invoices/{invoice_id}", response_model=schemas.Invoice)
def update_invoice(invoice_id: int, invoice_update: schemas.InvoiceUpdate, db: Session = Depends(get_db)):
    db_invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not db_invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    update_data = invoice_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_invoice, key, value)

    db.commit()
    db.refresh(db_invoice)
    return db_invoice

@router.get("/clients/{client_id}/summary")
def summary(client_id: int, db: Session = Depends(get_db)): return logic.calculate_summary(db, client_id)

@router.get("/clients/{client_id}/turnover", response_model=List[schemas.Turnover])
def get_turnover(client_id: int, db: Session = Depends(get_db)):
    return db.query(models.MonthlyTurnover).filter(models.MonthlyTurnover.client_id == client_id).all()

@router.post("/clients/{client_id}/turnover", response_model=schemas.Turnover)
def create_or_update_turnover(client_id: int, turnover: schemas.TurnoverCreate, db: Session = Depends(get_db)):
    db_turnover = db.query(models.MonthlyTurnover).filter(
        models.MonthlyTurnover.client_id == client_id,
        models.MonthlyTurnover.month == turnover.month
    ).first()

    if db_turnover:
        for key, value in turnover.dict().items():
            setattr(db_turnover, key, value)
    else:
        db_turnover = models.MonthlyTurnover(client_id=client_id, **turnover.dict())
        db.add(db_turnover)

    db.commit()
    db.refresh(db_turnover)
    return db_turnover

@router.get("/clients/{client_id}/export")
def export(client_id: int, db: Session = Depends(get_db)):
    return StreamingResponse(logic.export_to_excel(db, client_id), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

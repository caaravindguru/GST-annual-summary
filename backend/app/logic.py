import pandas as pd
from sqlalchemy.orm import Session
from . import models
import io

def parse_excel(file_content: bytes, client_id: int):
    file_like = io.BytesIO(file_content)
    try:
        df = pd.read_excel(file_like)
    except:
        file_like.seek(0)
        df = pd.read_csv(file_like)

    column_mapping = {
        'Mont': 'month', 'Particular': 'particular', 'GSTIN of supplier': 'gstin',
        'Trade/Legal name': 'trade_name', 'Invoice number': 'invoice_number',
        'Invoice Date': 'invoice_date', 'Rate(%)': 'rate', 'Taxable Value (₹)': 'taxable_value',
        'IGST': 'igst', 'CGST': 'cgst', 'SGST': 'sgst', 'Status': 'status'
    }

    df.columns = [str(c).strip() for c in df.columns]
    final_mapping = {}
    for k, v in column_mapping.items():
        for c in df.columns:
            if k.lower() in str(c).lower():
                final_mapping[c] = v
                break
    df = df.rename(columns=final_mapping)

    if 'invoice_date' in df.columns:
        df['invoice_date'] = pd.to_datetime(df['invoice_date'], errors='coerce').dt.date

    for col in ['igst', 'cgst', 'sgst', 'taxable_value', 'rate']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    df = df.fillna({'status': 'Unknown', 'sub_status': '', 'is_common_itc': False})

    invoices = []
    for _, row in df.iterrows():
        # Clean row to only include model fields
        row_dict = row.to_dict()
        valid_fields = {k: v for k, v in row_dict.items() if k in models.Invoice.__table__.columns.keys()}
        invoices.append(models.Invoice(client_id=client_id, **valid_fields))
    return invoices

def calculate_summary(db: Session, client_id: int):
    invoices = db.query(models.Invoice).filter(models.Invoice.client_id == client_id).all()
    turnovers = {t.month: t for t in db.query(models.MonthlyTurnover).filter(models.MonthlyTurnover.client_id == client_id).all()}
    months = sorted(list(set([inv.month for inv in invoices if inv.month])))
    summary = []

    for month in months:
        m_invs = [i for i in invoices if i.month == month]
        t = turnovers.get(month)
        s = {k: {'igst':0.0, 'cgst':0.0, 'sgst':0.0} for k in ['4a', 'rule_42', 'blocked', 'temp', 'reclaim']}
        common = {'igst':0.0, 'cgst':0.0, 'sgst':0.0}

        for inv in m_invs:
            if inv.particular == 'GSTR2B':
                for k in ['igst', 'cgst', 'sgst']: s['4a'][k] += getattr(inv, k)
            if inv.status == 'Not in books' or (inv.status == 'Ineligible' and inv.sub_status != 'Blocked'):
                for k in ['igst', 'cgst', 'sgst']: s['temp'][k] += getattr(inv, k)
            if inv.status == 'Ineligible' and inv.sub_status == 'Blocked':
                for k in ['igst', 'cgst', 'sgst']: s['blocked'][k] += getattr(inv, k)
            if inv.is_common_itc and inv.status == 'Matched':
                for k in ['igst', 'cgst', 'sgst']: common[k] += getattr(inv, k)
            if inv.status == 'Matched':
                was_not = db.query(models.Invoice).filter(models.Invoice.client_id==client_id, models.Invoice.invoice_number==inv.invoice_number, models.Invoice.status=='Not in books').first()
                if was_not:
                    for k in ['igst', 'cgst', 'sgst']: s['reclaim'][k] += getattr(inv, k)

        if t and t.total_turnover > 0:
            ratio = (t.nil_rated_turnover + t.exempt_turnover) / t.total_turnover
            for k in ['igst', 'cgst', 'sgst']: s['rule_42'][k] = common[k] * ratio

        net = {k: s['4a'][k] - (s['rule_42'][k] + s['blocked'][k] + s['temp'][k]) + s['reclaim'][k] for k in ['igst', 'cgst', 'sgst']}
        summary.append({'month': month, 'table_4a': s['4a'], 'rule_42': s['rule_42'], 'blocked': s['blocked'], 'temp_reversal': s['temp'], 'reclaim_others': s['reclaim'], 'net_itc': net})
    return summary

def export_to_excel(db: Session, client_id: int):
    summary = calculate_summary(db, client_id)
    invoices = db.query(models.Invoice).filter(models.Invoice.client_id == client_id).all()
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        pd.DataFrame([{'Month': s['month'], **{f"{k}_{t.upper()}": v for k, d in s.items() if isinstance(d, dict) for t, v in d.items()}} for s in summary]).to_excel(writer, sheet_name='Summary', index=False)
        pd.DataFrame([i.__dict__ for i in invoices]).drop(columns=['_sa_instance_state']).to_excel(writer, sheet_name='Invoices', index=False)
    output.seek(0)
    return output

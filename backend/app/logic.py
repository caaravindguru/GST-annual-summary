import pandas as pd
from sqlalchemy.orm import Session
from . import models
import io
import re

def clean_numeric(value):
    if pd.isna(value) or value == '-':
        return 0.0
    if isinstance(value, str):
        # Remove commas and other non-numeric characters except dot and minus
        value = re.sub(r'[^\d.-]', '', value)
    try:
        return float(value)
    except:
        return 0.0

def parse_excel(file_content: bytes, client_id: int):
    file_like = io.BytesIO(file_content)
    try:
        df = pd.read_excel(file_like)
    except:
        file_like.seek(0)
        df = pd.read_csv(file_like)

    column_mapping = {
        'month': 'month', 'mont': 'month', 'particular': 'particular',
        'gstin': 'gstin', 'trade': 'trade_name', 'legal': 'trade_name',
        'invoice number': 'invoice_number', 'invoice date': 'invoice_date',
        'rate': 'rate', 'taxable value': 'taxable_value',
        'igst': 'igst', 'cgst': 'cgst', 'sgst': 'sgst', 'status': 'status'
    }

    df.columns = [str(c).strip() for c in df.columns]
    final_mapping = {}
    # Prioritize exact matches first, then partial
    for col in df.columns:
        col_lower = col.lower()
        for k, v in column_mapping.items():
            if k in col_lower:
                final_mapping[col] = v
                break
    df = df.rename(columns=final_mapping)

    if 'invoice_date' in df.columns:
        df['invoice_date'] = pd.to_datetime(df['invoice_date'], errors='coerce')
        df['invoice_date'] = df['invoice_date'].where(df['invoice_date'].notna(), None).dt.date

    if 'month' in df.columns:
        # Pandas often parses 'Apr-24' as a datetime; convert to string
        df['month'] = df['month'].apply(lambda x: x.strftime('%b-%y') if isinstance(x, pd.Timestamp) else str(x))

    # Ensure all expected columns exist and are cleaned
    for col in ['igst', 'cgst', 'sgst', 'taxable_value', 'rate']:
        if col not in df.columns:
            df[col] = 0.0
        else:
            df[col] = df[col].apply(clean_numeric)

    # Fill non-numeric missing values and handle NaN for SQLAlchemy compatibility
    for col in ['month', 'particular', 'gstin', 'trade_name', 'invoice_number', 'status']:
        if col not in df.columns:
            df[col] = ''
        else:
            df[col] = df[col].fillna('')

    if 'status' in df.columns:
        df['status'] = df['status'].apply(lambda x: x if x else 'Unknown')
    else:
        df['status'] = 'Unknown'

    invoices = []
    # Replace NaN with None for SQLAlchemy compatibility
    df = df.where(pd.notnull(df), None)

    for _, row in df.iterrows():
        # Clean row to only include model fields, exclude primary key 'id'
        row_dict = row.to_dict()
        valid_fields = {
            k: v for k, v in row_dict.items()
            if k in models.Invoice.__table__.columns.keys() and k != 'id'
        }
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
        # GSTR-3B Table 4 structure
        # 4A5: All other ITC
        # 4B1: Reversals (Rule 42 + Permanent)
        # 4B2: Reversals (Not in books + Temporary)
        # 4C: Net ITC
        s = {k: {'igst':0.0, 'cgst':0.0, 'sgst':0.0} for k in ['4a5', '4b1', '4b2', 'rule_42']}
        common = {'igst':0.0, 'cgst':0.0, 'sgst':0.0}

        for inv in m_invs:
            # 4A5 includes almost everything from the 2B feed
            for k in ['igst', 'cgst', 'sgst']:
                val = getattr(inv, k) or 0.0
                s['4a5'][k] += val

                if inv.status == 'Not in books':
                    s['4b2'][k] += val
                elif inv.status == 'Ineligible':
                    if str(inv.sub_status).lower() == 'permanent':
                        s['4b1'][k] += val
                    else:
                        s['4b2'][k] += val

                if inv.is_common_itc:
                    common[k] += val

        if t and t.total_turnover > 0:
            ratio = (t.nil_rated_turnover + t.exempt_turnover) / t.total_turnover
            for k in ['igst', 'cgst', 'sgst']:
                s['rule_42'][k] = common[k] * ratio
                s['4b1'][k] += s['rule_42'][k]

        net = {k: s['4a5'][k] - s['4b1'][k] - s['4b2'][k] for k in ['igst', 'cgst', 'sgst']}
        summary.append({
            'month': month,
            'table_4a5': s['4a5'],
            'table_4b1': s['4b1'],
            'table_4b2': s['4b2'],
            'rule_42': s['rule_42'],
            'net_itc': net
        })
    return summary

def export_to_excel(db: Session, client_id: int):
    summary = calculate_summary(db, client_id)
    invoices = db.query(models.Invoice).filter(models.Invoice.client_id == client_id).all()
    output = io.BytesIO()

    # Prepare invoice-wise details for different tables
    inv_list = []
    for inv in invoices:
        d = {
            'Month': inv.month,
            'Particulars': inv.particular,
            'GSTIN': inv.gstin,
            'Trade Name': inv.trade_name,
            'Invoice No': inv.invoice_number,
            'Date': inv.invoice_date,
            'Taxable Value': inv.taxable_value,
            'IGST': inv.igst,
            'CGST': inv.cgst,
            'SGST': inv.sgst,
            'Status': inv.status,
            'Sub-Status': inv.sub_status,
            'Common ITC': 'Yes' if inv.is_common_itc else 'No'
        }

        # Classification for GSTR-3B
        d['GSTR-3B Table'] = '4A(5)'
        if inv.status == 'Not in books':
            d['GSTR-3B Reversal'] = '4B(2)'
        elif inv.status == 'Ineligible':
            if str(inv.sub_status).lower() == 'permanent':
                d['GSTR-3B Reversal'] = '4B(1)'
            else:
                d['GSTR-3B Reversal'] = '4B(2)'
        else:
            d['GSTR-3B Reversal'] = 'None'

        inv_list.append(d)

    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Summary Sheet
        summary_df = pd.DataFrame([{
            'Month': s['month'],
            '4A(5) IGST': s['table_4a5']['igst'],
            '4A(5) CGST': s['table_4a5']['cgst'],
            '4A(5) SGST': s['table_4a5']['sgst'],
            '4B(1) IGST': s['table_4b1']['igst'],
            '4B(1) CGST': s['table_4b1']['cgst'],
            '4B(1) SGST': s['table_4b1']['sgst'],
            '4B(2) IGST': s['table_4b2']['igst'],
            '4B(2) CGST': s['table_4b2']['cgst'],
            '4B(2) SGST': s['table_4b2']['sgst'],
            'Rule 42 IGST': s['rule_42']['igst'],
            'Net ITC IGST': s['net_itc']['igst'],
            'Net ITC CGST': s['net_itc']['cgst'],
            'Net ITC SGST': s['net_itc']['sgst'],
        } for s in summary])
        summary_df.to_excel(writer, sheet_name='GSTR-3B Summary', index=False)

        # Detailed Invoice Sheet
        pd.DataFrame(inv_list).to_excel(writer, sheet_name='Invoice Details', index=False)

    output.seek(0)
    return output

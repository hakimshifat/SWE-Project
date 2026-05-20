from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import OperationLog


def log_operation(
    db: Session,
    *,
    user_id: int | None,
    operation_type: str,
    operation_status: str,
    message: str,
    stego_file_id: int | None = None,
) -> OperationLog:
    log = OperationLog(
        user_id=user_id,
        stego_file_id=stego_file_id,
        operation_type=operation_type,
        operation_status=operation_status,
        message=message,
    )
    db.add(log)
    return log


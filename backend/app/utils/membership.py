from datetime import datetime
from sqlalchemy.orm import Session

from app.models import Member, MemberPoint


def earn_points(member: Member, paid_amount: float, order_id: int | None, db: Session) -> int:
    """Earn points based on tier point_rate * paid_amount. Returns points earned."""
    if not member or not member.is_active or member.tier is None:
        return 0
    rate = (member.tier.point_rate or 0)
    if rate <= 0 or paid_amount <= 0:
        return 0
    pts = int(paid_amount * rate)
    if pts <= 0:
        return 0
    member.points += pts
    db.add(MemberPoint(
        member_id=member.id,
        order_id=order_id,
        points=pts,
        balance_after=member.points,
        type="earn",
        description="Belanja",
    ))
    db.add(member)
    db.commit()
    db.refresh(member)
    return pts


def redeem_points(member: Member, points: int, db: Session) -> int:
    """Redeem member points -> Rupiah value (1 point = 1 Rupiah by default). Returns discount value."""
    if points <= 0 or member.points < points:
        raise ValueError("Poin tidak mencukupi")
    member.points -= points
    db.add(MemberPoint(
        member_id=member.id,
        points=-points,
        balance_after=member.points,
        type="redeem",
        description="Redeem diskon",
    ))
    db.add(member)
    db.commit()
    db.refresh(member)
    return points

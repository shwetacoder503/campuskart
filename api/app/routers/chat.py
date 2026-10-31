import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Conversation, Message, Product, User
from app.routers.products import image_urls_for
from app.schemas import (
    ChatOut,
    ConversationList,
    ConversationOut,
    ConversationStart,
    LastMessage,
    MessageCreate,
    MessageOut,
    ProductBrief,
    UnreadCount,
)

router = APIRouter(prefix="/api/conversations", tags=["chat"])

MAX_MESSAGES_PER_MINUTE = 20
MAX_NEW_CHATS_PER_DAY = 10

# 10 ya zyada digits (space, dash, bracket ke saath bhi) = phone number jaisa
PHONE_RE = re.compile(r"(?:\+?\d[\s\-().]*){10,}")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")


def check_contact_info(body: str) -> None:
    if PHONE_RE.search(body) or EMAIL_RE.search(body):
        raise HTTPException(
            status_code=400,
            detail="For your safety, please do not share phone numbers or email addresses in chat.",
        )


def enforce_message_rate(db: Session, user: User) -> None:
    recent = db.scalar(
        select(func.count(Message.id)).where(
            Message.sender_id == user.id,
            Message.created_at > func.date_sub(func.now(), text("INTERVAL 1 MINUTE")),
        )
    ) or 0
    if recent >= MAX_MESSAGES_PER_MINUTE:
        raise HTTPException(
            status_code=429, detail="You are sending messages too fast. Please wait a moment."
        )


def get_conversation_for(db: Session, conversation_id: int, user: User) -> Conversation:
    conv = db.get(Conversation, conversation_id)
    # Participant nahi hai toh bhi 404, taaki pata hi na chale ki chat exist karti hai
    if conv is None or user.id not in (conv.buyer_id, conv.seller_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


def mark_read(conv: Conversation, user: User, last_id: int) -> None:
    if conv.buyer_id == user.id:
        conv.buyer_last_read_id = max(conv.buyer_last_read_id, last_id)
    else:
        conv.seller_last_read_id = max(conv.seller_last_read_id, last_id)


def my_read_column(user: User):
    return case(
        (Conversation.buyer_id == user.id, Conversation.buyer_last_read_id),
        else_=Conversation.seller_last_read_id,
    )


def build_summaries(db: Session, convs: list[Conversation], me: User) -> list[ConversationOut]:
    if not convs:
        return []
    ids = [c.id for c in convs]
    product_ids = list({c.product_id for c in convs})

    products = {
        p.id: p for p in db.scalars(select(Product).where(Product.id.in_(product_ids))).all()
    }
    images = image_urls_for(db, product_ids)

    other_ids = {c.seller_id if c.buyer_id == me.id else c.buyer_id for c in convs}
    names = dict(db.execute(select(User.id, User.full_name).where(User.id.in_(other_ids))).all())

    latest_ids = (
        select(func.max(Message.id))
        .where(Message.conversation_id.in_(ids))
        .group_by(Message.conversation_id)
    )
    last = {
        m.conversation_id: m
        for m in db.scalars(select(Message).where(Message.id.in_(latest_ids))).all()
    }

    unread = dict(
        db.execute(
            select(Message.conversation_id, func.count(Message.id))
            .join(Conversation, Conversation.id == Message.conversation_id)
            .where(
                Conversation.id.in_(ids),
                Message.sender_id != me.id,
                Message.id > my_read_column(me),
            )
            .group_by(Message.conversation_id)
        ).all()
    )

    out: list[ConversationOut] = []
    for c in convs:
        p = products[c.product_id]
        buying = c.buyer_id == me.id
        other_id = c.seller_id if buying else c.buyer_id
        m = last.get(c.id)
        out.append(
            ConversationOut(
                id=c.id,
                role="BUYING" if buying else "SELLING",
                other_name=names.get(other_id, "Unknown"),
                product=ProductBrief(
                    id=p.id,
                    title=p.title,
                    price=p.price,
                    status=p.status,
                    image=(images.get(p.id) or [None])[0],
                ),
                last_message=(
                    LastMessage(body=m.body, created_at=m.created_at, mine=m.sender_id == me.id)
                    if m
                    else None
                ),
                unread_count=unread.get(c.id, 0),
                last_message_at=c.last_message_at,
            )
        )
    return out


def to_message_out(m: Message, me: User) -> MessageOut:
    return MessageOut(
        id=m.id,
        sender_id=m.sender_id,
        mine=m.sender_id == me.id,
        body=m.body,
        created_at=m.created_at,
    )


@router.post("", response_model=ConversationOut, status_code=201)
def start_conversation(
    data: ConversationStart,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Chat shuru karo (ya agar pehle se hai toh us me message jodo)."""
    product = db.get(Product, data.product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.seller_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot message yourself about your own item")
    check_contact_info(data.message)

    conv = db.scalar(
        select(Conversation).where(
            Conversation.product_id == product.id, Conversation.buyer_id == user.id
        )
    )
    if conv is None:
        if product.status == "SOLD":
            raise HTTPException(status_code=409, detail="This item has already been sold")
        new_chats = db.scalar(
            select(func.count(Conversation.id)).where(
                Conversation.buyer_id == user.id,
                Conversation.created_at > func.date_sub(func.now(), text("INTERVAL 1 DAY")),
            )
        ) or 0
        if new_chats >= MAX_NEW_CHATS_PER_DAY:
            raise HTTPException(
                status_code=429, detail="You have started too many chats today. Try again tomorrow."
            )
        conv = Conversation(
            product_id=product.id, buyer_id=user.id, seller_id=product.seller_id
        )
        db.add(conv)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()  # do click ek saath aaye toh pehli wali chat use karo
            conv = db.scalar(
                select(Conversation).where(
                    Conversation.product_id == product.id, Conversation.buyer_id == user.id
                )
            )
            if conv is None:
                raise HTTPException(status_code=409, detail="Could not start the chat. Please try again.")

    enforce_message_rate(db, user)
    msg = Message(conversation_id=conv.id, sender_id=user.id, body=data.message)
    db.add(msg)
    db.flush()
    conv.last_message_at = func.now()
    mark_read(conv, user, msg.id)
    db.commit()
    db.refresh(conv)
    return build_summaries(db, [conv], user)[0]


@router.get("", response_model=ConversationList)
def inbox(
    role: Literal["BUYING", "SELLING"] | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if role == "BUYING":
        cond = Conversation.buyer_id == user.id
    elif role == "SELLING":
        cond = Conversation.seller_id == user.id
    else:
        cond = (Conversation.buyer_id == user.id) | (Conversation.seller_id == user.id)

    total = db.scalar(select(func.count(Conversation.id)).where(cond)) or 0
    convs = db.scalars(
        select(Conversation)
        .where(cond)
        .order_by(
            func.coalesce(Conversation.last_message_at, Conversation.created_at).desc(),
            Conversation.id.desc(),
        )
        .limit(size)
        .offset((page - 1) * size)
    ).all()
    return ConversationList(
        items=build_summaries(db, list(convs), user), page=page, size=size, total=total
    )


@router.get("/unread-count", response_model=UnreadCount)
def unread_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    count = db.scalar(
        select(func.count(Message.id))
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(
            (Conversation.buyer_id == user.id) | (Conversation.seller_id == user.id),
            Message.sender_id != user.id,
            Message.id > my_read_column(user),
        )
    ) or 0
    return UnreadCount(unread=count)


@router.get("/{conversation_id}/messages", response_model=ChatOut)
def read_chat(
    conversation_id: int,
    after_id: int = Query(0, alias="afterId", ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """afterId na do toh latest 100 messages. afterId do toh sirf uske baad ke naye messages."""
    conv = get_conversation_for(db, conversation_id, user)

    if after_id:
        msgs = list(
            db.scalars(
                select(Message)
                .where(Message.conversation_id == conv.id, Message.id > after_id)
                .order_by(Message.id.asc())
                .limit(100)
            ).all()
        )
    else:
        latest = db.scalars(
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(Message.id.desc())
            .limit(100)
        ).all()
        msgs = list(reversed(latest))

    if msgs:
        mark_read(conv, user, msgs[-1].id)
        db.commit()

    summary = build_summaries(db, [conv], user)[0] if not after_id else None
    return ChatOut(conversation=summary, messages=[to_message_out(m, user) for m in msgs])


@router.post("/{conversation_id}/messages", response_model=MessageOut, status_code=201)
def send_message(
    conversation_id: int,
    data: MessageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = get_conversation_for(db, conversation_id, user)
    check_contact_info(data.body)
    enforce_message_rate(db, user)

    msg = Message(conversation_id=conv.id, sender_id=user.id, body=data.body)
    db.add(msg)
    db.flush()
    conv.last_message_at = func.now()
    mark_read(conv, user, msg.id)
    db.commit()
    db.refresh(msg)
    return to_message_out(msg, user)
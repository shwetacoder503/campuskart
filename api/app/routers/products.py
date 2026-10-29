from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Product, ProductImage, User
from app.schemas import (
    Category,
    ProductCreate,
    ProductList,
    ProductOut,
    ProductStatus,
)
from app.storage import MAX_BYTES, delete_image, save_image

router = APIRouter(prefix="/api/products", tags=["products"])

MAX_IMAGES = 5


def image_urls_for(db: Session, product_ids: list[int]) -> dict[int, list[str]]:
    if not product_ids:
        return {}
    rows = db.execute(
        select(ProductImage.product_id, ProductImage.file_name)
        .where(ProductImage.product_id.in_(product_ids))
        .order_by(ProductImage.sort_order, ProductImage.id)
    ).all()
    result: dict[int, list[str]] = {}
    for product_id, file_name in rows:
        result.setdefault(product_id, []).append("/uploads/" + file_name)
    return result


def to_out(p: Product, seller_name: str, images: list[str] | None = None) -> ProductOut:
    return ProductOut(
        id=p.id,
        seller_id=p.seller_id,
        seller_name=seller_name,
        title=p.title,
        description=p.description,
        category=p.category,
        price=p.price,
        item_condition=p.item_condition,
        status=p.status,
        created_at=p.created_at,
        updated_at=p.updated_at,
        images=images or [],
    )


@router.post("", response_model=ProductOut, status_code=201)
def create_product(
    data: ProductCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # seller_id hamesha token wale user se, body se kabhi nahi
    product = Product(
        seller_id=user.id,
        title=data.title,
        description=data.description,
        category=data.category,
        price=data.price,
        item_condition=data.item_condition,
        status="AVAILABLE",
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return to_out(product, user.full_name)


@router.post("/{product_id}/images", response_model=ProductOut, status_code=201)
def upload_images(
    product_id: int,
    files: list[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.seller_id != user.id:
        raise HTTPException(status_code=403, detail="You can only add photos to your own items")

    existing = db.scalar(
        select(func.count(ProductImage.id)).where(ProductImage.product_id == product_id)
    ) or 0
    if existing + len(files) > MAX_IMAGES:
        raise HTTPException(
            status_code=400, detail=f"An item can have at most {MAX_IMAGES} photos"
        )

    saved: list[str] = []
    try:
        for i, f in enumerate(files):
            raw = f.file.read(MAX_BYTES + 1)  # +1 se pata chalta hai file bahut badi hai
            name = save_image(raw)
            saved.append(name)
            db.add(ProductImage(product_id=product_id, file_name=name, sort_order=existing + i))
        db.commit()
    except Exception:
        db.rollback()
        for name in saved:  # adhura upload ho toh files saaf karo
            delete_image(name)
        raise

    db.refresh(product)
    urls = image_urls_for(db, [product_id]).get(product_id, [])
    return to_out(product, user.full_name, urls)


@router.get("", response_model=ProductList)
def list_products(
    search: str | None = Query(None, max_length=100),
    category: Category | None = None,
    max_price: float | None = Query(None, alias="maxPrice", gt=0),
    status: ProductStatus | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    filters = []
    if status is not None:
        filters.append(Product.status == status)
    else:
        filters.append(Product.status != "SOLD")  # default me SOLD hide
    if category is not None:
        filters.append(Product.category == category)
    if max_price is not None:
        filters.append(Product.price <= max_price)
    if search:
        # % aur _ ko normal character banao (LIKE injection se bachne ke liye)
        term = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        like = f"%{term}%"
        filters.append(
            Product.title.ilike(like, escape="\\")
            | Product.description.ilike(like, escape="\\")
        )

    total = db.scalar(select(func.count(Product.id)).where(*filters)) or 0
    rows = db.execute(
        select(Product, User.full_name)
        .join(User, User.id == Product.seller_id)
        .where(*filters)
        .order_by(Product.created_at.desc(), Product.id.desc())
        .limit(size)
        .offset((page - 1) * size)
    ).all()

    images = image_urls_for(db, [p.id for p, _ in rows])
    return ProductList(
        items=[to_out(p, name, images.get(p.id)) for p, name in rows],
        page=page,
        size=size,
        total=total,
    )


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    row = db.execute(
        select(Product, User.full_name)
        .join(User, User.id == Product.seller_id)
        .where(Product.id == product_id)
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Product not found")
    images = image_urls_for(db, [product_id]).get(product_id)
    return to_out(row[0], row[1], images)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import auth, products, users
from app.storage import UPLOAD_DIR

app = FastAPI(title="CampusKart API")

origins = list({settings.frontend_base_url, "http://localhost:5500", "http://127.0.0.1:5500"})
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(products.router)

# Upload ki hui photos yahan se milti hain: /uploads/<file>.jpg
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "UP"}
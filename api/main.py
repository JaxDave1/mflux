from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import config, controlnet, depth_pro, gallery, img2img, inpaint, kontext, models, system, txt2img, upscaler

app = FastAPI(title="MFLUX Neural Interface API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:4173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system.router)
app.include_router(models.router)
app.include_router(config.router)
app.include_router(gallery.router)
app.include_router(txt2img.router)
app.include_router(img2img.router)
app.include_router(inpaint.router)
app.include_router(kontext.router)
app.include_router(controlnet.router)
app.include_router(upscaler.router)
app.include_router(depth_pro.router)

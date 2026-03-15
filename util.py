import os
import re
import json
import shutil
import mimetypes
from urllib.parse import quote
from aiohttp import web
from server import PromptServer
import folder_paths

# 节点根目录
NODE_DIR = os.path.dirname(os.path.abspath(__file__))

def get_config_path(filename="config.json"):
    """获取配置文件绝对路径"""
    return os.path.join(NODE_DIR, filename)

def read_json_file(filename="config.json", default=None):
    """读取 JSON 文件，如果不存在返回默认值"""
    if default is None:
        default = {}
    
    filepath = get_config_path(filename)
    
    if not os.path.exists(filepath):
        return default
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[A1RWorkshop] Error reading {filename}: {e}")
        return default

def write_json_file(data, filename="config.json"):
    """写入 JSON 文件"""
    filepath = get_config_path(filename)
    
    try:
        # 确保目录存在
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return True
    except Exception as e:
        print(f"[A1RWorkshop] Error writing {filename}: {e}")
        return False

# ========== 注册 ComfyUI V3 API 端点 ==========

def _register_routes():
    """内部函数：注册自定义 API 路由"""
    
    @PromptServer.instance.routes.get("/api/a1rworkshop/config")
    async def api_get_config(request):
        """GET /api/a1rworkshop/config - 读取 config.json"""
        try:
            config = read_json_file("config.json", default={"EmbeddingTags": {}})
            return web.json_response(config)
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)
    
    @PromptServer.instance.routes.post("/api/a1rworkshop/config")
    async def api_post_config(request):
        """POST /api/a1rworkshop/config - 保存 config.json"""
        try:
            data = await request.json()
            if write_json_file(data, "config.json"):
                return web.json_response({"success": True})
            else:
                return web.json_response({"error": "Failed to write config"}, status=500)
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

# 模块导入时自动注册
_register_routes()

# ========== 图像缓存 ==========

CACHE_DIR = os.path.join(NODE_DIR, ".cache")


def _is_safe_filename(name: str) -> bool:
    """检查文件名是否安全（无路径遍历字符）"""
    return ".." not in name and "/" not in name and "\\" not in name


def _resolve_image_path(filename: str, subfolder: str, img_type: str) -> str | None:
    """根据 ComfyUI 的 type/subfolder/filename 定位源文件"""
    output_dir = folder_paths.get_directory_by_type(img_type)
    if output_dir is None:
        return None
    if subfolder:
        output_dir = os.path.join(output_dir, subfolder)
    full = os.path.join(output_dir, os.path.basename(filename))
    if os.path.isfile(full):
        return full
    return None

def _register_cache_routes():

    @PromptServer.instance.routes.post("/api/a1rworkshop/cache_images")
    async def api_cache_images(request):
        """POST body: { seed: number, images: [{filename, subfolder, type}] }
        复制到 .cache/，文件名 {seed}_{index}.ext，返回 { cached: ["name", ...] }"""
        try:
            data = await request.json()
            seed = data.get("seed", 0)
            images = data.get("images", [])
            os.makedirs(CACHE_DIR, exist_ok=True)

            cached = []
            for idx, img in enumerate(images):
                src = _resolve_image_path(
                    img.get("filename", ""),
                    img.get("subfolder", ""),
                    img.get("type", "output"),
                )
                if src is None:
                    continue
                ext = os.path.splitext(src)[1] or ".png"
                name = f"{seed}_{idx}{ext}"
                shutil.copy2(src, os.path.join(CACHE_DIR, name))
                cached.append(name)

            return web.json_response({"cached": cached})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.get("/api/a1rworkshop/cache/{filename}")
    async def api_get_cached(request):
        """提供 .cache/ 中的文件"""
        filename = request.match_info["filename"]
        # 安全校验：仅允许访问 .cache/ 目录
        if not _is_safe_filename(filename):
            return web.Response(status=400)
        filepath = os.path.join(CACHE_DIR, filename)
        if not os.path.isfile(filepath):
            return web.Response(status=404)
        return web.FileResponse(filepath)

    @PromptServer.instance.routes.post("/api/a1rworkshop/clear_cache")
    async def api_clear_cache(request):
        """清空 .cache/ 目录"""
        try:
            if os.path.isdir(CACHE_DIR):
                shutil.rmtree(CACHE_DIR)
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.post("/api/a1rworkshop/delete_seed_cache")
    async def api_delete_seed_cache(request):
        """POST body: { seed: number } — 删除 .cache/ 中以 {seed}_ 开头的文件"""
        try:
            data = await request.json()
            seed = str(data.get("seed", ""))
            if not seed or not CACHE_DIR or not os.path.isdir(CACHE_DIR):
                return web.json_response({"deleted": 0})
            prefix = seed + "_"
            deleted = 0
            for f in os.listdir(CACHE_DIR):
                if f.startswith(prefix):
                    os.remove(os.path.join(CACHE_DIR, f))
                    deleted += 1
            return web.json_response({"deleted": deleted})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

_register_cache_routes()

# ========== 模型预览图 ==========

_IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'}

def _list_model_previews(folder: str, filename: str) -> list[dict]:
    """
    查找模型同级目录下的预览图。
    命名规则：
        - {model_basename}.{img_ext}          → 视为序号 0
        - {model_basename}_{序号}.{img_ext}   → 按序号排序
    返回按序号升序排列的列表。
    """
    full_path = folder_paths.get_full_path(folder, filename)
    if not full_path:
        return []

    dirname = os.path.dirname(full_path)
    model_basename = os.path.splitext(os.path.basename(full_path))[0]

    if not os.path.isdir(dirname):
        return []

    # 匹配 {basename}.ext 或 {basename}_{数字}.ext
    pattern = re.compile(
        r'^' + re.escape(model_basename) + r'(?:_(\d+))?\.(' +
        '|'.join(ext.lstrip('.') for ext in _IMAGE_EXTS) +
        r')$',
        re.IGNORECASE,
    )

    results: list[tuple[int, str]] = []
    for entry in os.listdir(dirname):
        m = pattern.match(entry)
        if m:
            sort_key = int(m.group(1)) if m.group(1) else 0
            results.append((sort_key, entry))

    results.sort(key=lambda t: t[0])
    return [{"file": name, "dir": dirname} for _, name in results]


def _register_model_preview_routes():

    @PromptServer.instance.routes.get("/api/a1rworkshop/model_previews")
    async def api_model_preview_list(request):
        """GET ?folder=checkpoints&filename=model.safetensors
        返回 { images: ["url1", "url2", ...] }"""
        folder = request.query.get("folder", "")
        filename = request.query.get("filename", "")
        if not folder or not filename:
            return web.json_response({"images": []})

        previews = _list_model_previews(folder, filename)
        urls = []
        for p in previews:
            encoded = quote(p["file"], safe="")
            urls.append(
                f"/api/a1rworkshop/model_preview_image"
                f"?folder={quote(folder, safe='')}"
                f"&filename={quote(filename, safe='')}"
                f"&image={encoded}"
            )
        return web.json_response({"images": urls})

    @PromptServer.instance.routes.get("/api/a1rworkshop/model_preview_image")
    async def api_model_preview_image(request):
        """GET ?folder=...&filename=...&image=... — 服务模型预览图文件"""
        folder = request.query.get("folder", "")
        filename = request.query.get("filename", "")
        image = request.query.get("image", "")
        if not folder or not filename or not image:
            return web.Response(status=400)

        # 安全：禁止路径遍历
        if not _is_safe_filename(image):
            return web.Response(status=400)

        full_path = folder_paths.get_full_path(folder, filename)
        if not full_path:
            return web.Response(status=404)

        image_path = os.path.join(os.path.dirname(full_path), image)
        if not os.path.isfile(image_path):
            return web.Response(status=404)

        # 确认文件确实在模型目录下
        real_dir = os.path.realpath(os.path.dirname(full_path))
        real_img = os.path.realpath(image_path)
        if not real_img.startswith(real_dir):
            return web.Response(status=403)

        content_type = mimetypes.guess_type(image_path)[0] or "image/png"
        return web.FileResponse(image_path, headers={"Content-Type": content_type})

    @PromptServer.instance.routes.get("/api/a1rworkshop/all_model_previews")
    async def api_all_model_previews(request):
        """GET ?folders=checkpoints,loras
        返回所有拥有预览图的模型列表:
        { models: [{ folder, filename, firstImage, count }, ...] }"""
        folders_param = request.query.get("folders", "checkpoints,loras")
        folders = [f.strip() for f in folders_param.split(",") if f.strip()]
        models = []
        for folder in folders:
            try:
                files = folder_paths.get_filename_list(folder)
            except Exception:
                continue
            for filename in files:
                previews = _list_model_previews(folder, filename)
                first_url = None
                if previews:
                    encoded = quote(previews[0]["file"], safe="")
                    first_url = (
                        f"/api/a1rworkshop/model_preview_image"
                        f"?folder={quote(folder, safe='')}"
                        f"&filename={quote(filename, safe='')}"
                        f"&image={encoded}"
                    )
                models.append({
                    "folder": folder,
                    "filename": filename,
                    "firstImage": first_url,
                    "count": len(previews),
                })
        return web.json_response({"models": models})

    MAX_PREVIEW_IMAGES = 10

    @PromptServer.instance.routes.post("/api/a1rworkshop/upload_model_preview")
    async def api_upload_model_preview(request):
        """POST multipart: folder, filename, file(s)
        自动按命名规则保存到模型同级目录。
        返回 { saved: ["name1", ...], urls: ["url1", ...] }"""
        try:
            reader = await request.multipart()
            folder = ""
            filename = ""
            file_parts = []

            while True:
                part = await reader.next()
                if part is None:
                    break
                if part.name == "folder":
                    folder = (await part.text()).strip()
                elif part.name == "filename":
                    filename = (await part.text()).strip()
                elif part.name == "files":
                    data = await part.read(decode=False)
                    part_filename = part.filename or "upload.png"
                    file_parts.append((part_filename, data))

            if not folder or not filename:
                return web.json_response({"error": "folder and filename required"}, status=400)

            full_path = folder_paths.get_full_path(folder, filename)
            if not full_path:
                return web.json_response({"error": "model not found"}, status=404)

            dirname = os.path.dirname(full_path)
            model_basename = os.path.splitext(os.path.basename(full_path))[0]

            # 获取已有预览图数量
            existing = _list_model_previews(folder, filename)
            next_index = len(existing)

            if next_index >= MAX_PREVIEW_IMAGES:
                return web.json_response(
                    {"error": f"Maximum {MAX_PREVIEW_IMAGES} preview images allowed"},
                    status=400,
                )

            saved = []
            urls = []
            for part_filename, data in file_parts:
                if next_index >= MAX_PREVIEW_IMAGES:
                    break
                ext = os.path.splitext(part_filename)[1].lower()
                if ext not in _IMAGE_EXTS:
                    ext = ".png"
                if next_index == 0:
                    save_name = f"{model_basename}{ext}"
                else:
                    save_name = f"{model_basename}_{next_index}{ext}"
                save_path = os.path.join(dirname, save_name)
                with open(save_path, "wb") as f:
                    f.write(data)
                saved.append(save_name)
                encoded = quote(save_name, safe="")
                urls.append(
                    f"/api/a1rworkshop/model_preview_image"
                    f"?folder={quote(folder, safe='')}"
                    f"&filename={quote(filename, safe='')}"
                    f"&image={encoded}"
                )
                next_index += 1

            # 清除前端缓存提示
            return web.json_response({"saved": saved, "urls": urls})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.post("/api/a1rworkshop/delete_model_previews")
    async def api_delete_model_previews(request):
        """POST body: { folder, filename, images: ["name1", ...] }
        删除指定的预览图文件，然后重命名剩余文件以保持连续编号。"""
        try:
            data = await request.json()
            folder = data.get("folder", "")
            filename = data.get("filename", "")
            images_to_delete = data.get("images", [])

            if not folder or not filename or not images_to_delete:
                return web.json_response({"error": "folder, filename and images required"}, status=400)

            full_path = folder_paths.get_full_path(folder, filename)
            if not full_path:
                return web.json_response({"error": "model not found"}, status=404)

            dirname = os.path.dirname(full_path)
            model_basename = os.path.splitext(os.path.basename(full_path))[0]
            real_dir = os.path.realpath(dirname)

            deleted = 0
            for img_name in images_to_delete:
                if not _is_safe_filename(img_name):
                    continue
                img_path = os.path.join(dirname, img_name)
                real_img = os.path.realpath(img_path)
                if not real_img.startswith(real_dir):
                    continue
                if os.path.isfile(img_path):
                    os.remove(img_path)
                    deleted += 1

            # 重命名剩余文件以保持连续编号
            remaining = _list_model_previews(folder, filename)
            for new_index, item in enumerate(remaining):
                old_name = item["file"]
                old_path = os.path.join(dirname, old_name)
                ext = os.path.splitext(old_name)[1]
                if new_index == 0:
                    new_name = f"{model_basename}{ext}"
                else:
                    new_name = f"{model_basename}_{new_index}{ext}"
                new_path = os.path.join(dirname, new_name)
                if old_path != new_path:
                    os.rename(old_path, new_path)

            return web.json_response({"deleted": deleted})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

_register_model_preview_routes()
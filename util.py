import os
import json
import shutil
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
        if ".." in filename or "/" in filename or "\\" in filename:
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
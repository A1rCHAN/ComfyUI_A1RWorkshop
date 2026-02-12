import os
import json
from aiohttp import web
from server import PromptServer

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
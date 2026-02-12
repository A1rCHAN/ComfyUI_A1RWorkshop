from comfy_api.latest import ComfyExtension, io

class SizeCanvas(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="SizeCanvas",
            display_name="Size Canvas",
            category="A1R Workspace/Config Pads",
            inputs=[
                io.Combo.Input(
                    "preset",
                    options=[
                        "Custom",
                        "Squire 512x512",
                        "Squire 768x768",
                        "Squire 1024x1024",
                        "Portrait 512x768",
                        "Portrait 768x1024",
                        "Portrait 1024x1536",
                        "Landscape 768x512",
                        "Landscape 1024x768",
                        "Landscape 1536x1024",
                        "16:9 1920x1080",
                        "16:9 1280x720",
                        "9:16 1080x1920",
                        "4:3 1024x768",
                        "3:4 768x1024"
                    ],
                    default="Squire 1024x1024"
                ),
                io.Int.Input(
                    "width",
                    default=1024,
                    min=128,
                    max=4096,
                    step=128,
                    display_mode=io.NumberDisplay.slider
                ),
                io.Int.Input(
                    "height",
                    default=1024,
                    min=128,
                    max=4096,
                    step=128,
                    display_mode=io.NumberDisplay.slider
                )
            ],
            outputs=[
                io.Int.Output("width"),
                io.Int.Output("height")
            ]
        )

    @classmethod
    def execute(cls, preset, width, height) -> io.NodeOutput:
        size_map = {
            "Squire 512x512": (512, 512),
            "Squire 768x768": (768, 768),
            "Squire 1024x1024": (1024, 1024),
            "Portrait 512x768": (512, 768),
            "Portrait 768x1024": (768, 1024),
            "Portrait 1024x1536": (1024, 1536),
            "Landscape 768x512": (768, 512),
            "Landscape 1024x768": (1024, 768),
            "Landscape 1536x1024": (1536, 1024),
            "16:9 1920x1080": (1920, 1080),
            "16:9 1280x720": (1280, 720),
            "9:16 1080x1920": (1080, 1920),
            "4:3 1024x768": (1024, 768),
            "3:4 768x1024": (768, 1024)
        }

        if preset != "Custom":
            width_out, height_out = size_map[preset]
        else:
            width_out = width
            height_out = height
        return io.NodeOutput(width_out, height_out)
    
class SeedControl(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="SeedControl",
            display_name="Seed Control",
            category="A1R Workspace/Config Pads",
            inputs=[
                io.Int.Input(
                    "seed",
                    default=0,
                    min=0,
                    max=0xffffffffffffffff
                )
            ],
            outputs=[
                io.Int.Output("seed")
            ]
        )

    @classmethod
    def execute(cls, seed) -> io.NodeOutput:
        return io.NodeOutput(seed)

class WidgetCollector(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="WidgetCollector",
            display_name="Widget Collector",
            category="A1R Workspace/Config Pads",
            inputs=[],
            outputs=[]
        )
    
    @classmethod
    def execute(cls) -> io.NodeOutput:
        return io.NodeOutput()

class NodeCollector(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="NodeCollector",
            display_name="Node Collector",
            category="A1R Workspace/Config Pads",
            inputs=[],
            outputs=[]
        )

    @classmethod
    def execute(cls) -> io.NodeOutput:
        return io.NodeOutput()

class ConfigPads(ComfyExtension):
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [
            SizeCanvas,
            SeedControl,
            WidgetCollector,
            NodeCollector
            ]

async def comfy_entrypoint() -> ConfigPads:
    return ConfigPads()
# type: ignore
import os
import random
import folder_paths
from PIL import Image, PngImagePlugin
import numpy as np
import json

"""Utility functions and classes for node configurations and common operations."""
"""Integer"""
class Int_to_Boolean:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "input_int": ("INT", {"default": 0, "min": -0xffffffffffffffff, "max": 0xffffffffffffffff, "step": 1}),
            }
        }

    RETURN_TYPES = ("BOOLEAN",)
    FUNCTION = "int_to_boolean"

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Convert an integer to a boolean value."

    def int_to_boolean(self, input_int):
        return (input_int != 0,)

"""Boolean"""
class Simple_Boolean:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "enable": ("BOOLEAN", {"default": True}),
            }
        }

    RETURN_TYPES = ("BOOLEAN",)
    FUNCTION = "pass_through"

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "A simple boolean pass-through node."

    def pass_through(self, enable):
        return (enable,)

class Boolean_Plus:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "enable_a": ("BOOLEAN", {"default": True}),
                "enable_b": ("BOOLEAN", {"default": False}),
                "enable_c": ("BOOLEAN", {"default": False}),
            }
        }
    
    RETURN_TYPES = ("BOOLEAN", "BOOLEAN", "BOOLEAN",)
    RETURN_NAMES = ("bool_a", "bool_b", "bool_c")
    FUNCTION = "pass_through"

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "A multiple way boolean node."

    def pass_through(self, enable_a, enable_b, enable_c):
        return (enable_a, enable_b, enable_c,)

class Boolean_to_Int:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "input_bool": ("BOOLEAN", {"default": True}),
                "true_value": ("INT", {"default": 1, "min": -0xffffffffffffffff, "max": 0xffffffffffffffff, "step": 1}),
                "false_value": ("INT", {"default": 0, "min": -0xffffffffffffffff, "max": 0xffffffffffffffff, "step": 1}),
            }
        }
    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("integer",)
    FUNCTION = "boolean_to_int"

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Convert a boolean value to a custom integer (configurable true/false mapping)."
    def boolean_to_int(self, input_bool, true_value, false_value):
        return (true_value if input_bool else false_value,)

class Boolean_AB:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "enable_a": ("BOOLEAN", {"default": True}),
                "enable_b": ("BOOLEAN", {"default": False}),
            }
        }
    RETURN_TYPES = ("BOOLEAN", "BOOLEAN",)
    RETURN_NAMES = ("boolean_a", "boolean_b")
    FUNCTION = "boolean_ab"

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Boolean toggle with always one behavior."

    def boolean_ab(self, enable_a, enable_b):
        if not enable_a and not enable_b:
            enable_a = True
        elif enable_a and enable_b:
            enable_b = False
        return (enable_a, enable_b)

class Boolean_A_B:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "enable_a": ("BOOLEAN", {"default": True}),
                "enable_b": ("BOOLEAN", {"default": False}),
            }
        }
    RETURN_TYPES = ("BOOLEAN", "BOOLEAN",)
    RETURN_NAMES = ("boolean_a", "boolean_b")
    FUNCTION = "boolean_a_b"

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Boolean toggle with one main behavior."

    def boolean_a_b(self, enable_a, enable_b):
        if (not enable_a) and enable_b:
            enable_a = True
        return (enable_a, enable_b)

class Math_Int:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "a": ("INT", {"default": 0, "min": -0xffffffffffffffff, "max": 0xffffffffffffffff, "step": 1}),
                "b": ("INT", {"default": 0, "min": -0xffffffffffffffff, "max": 0xffffffffffffffff, "step": 1}),
                "operation": (["add", "subtract", "multiply", "divide", "modulo", "power"],),
            },
        }

    RETURN_TYPES = ("INT",)
    FUNCTION = "int_math_operation"

    CATEGORY = "A1rSpace/Utils"

    def int_math_operation(self, a, b, operation):
        if operation == "add":
            result = a + b
        elif operation == "subtract":
            result = a - b
        elif operation == "multiply":
            result = a * b
        elif operation == "divide":
            result = a // b if b != 0 else 0
        elif operation == "modulo":
            result = a % b if b != 0 else 0
        elif operation == "power":
            result = a ** b
        return (result,)

class Math_LogicGate:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "a": ("BOOLEAN",),
                "b": ("BOOLEAN",),
                "operation": (["AND", "OR", "NOT"], {"default": "AND"}),
            },
        }

    RETURN_TYPES = ("BOOLEAN", "INT")
    FUNCTION = "logic_gate"

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Perform logical operations on two boolean inputs."

    def logic_gate(self, a, b, operation):
        if operation == "AND":
            result = a and b
        elif operation == "OR":
            result = a or b
        elif operation == "NOT":
            result = not a

        int_value = 1 if result else 0

        return (result, int_value)

class Save_PreviewImage:
    def __init__(self):
        self.output_dir = folder_paths.get_output_directory()
        self.temp_dir = folder_paths.get_temp_directory()
        self.compress_level = 4
        self.prefix_append = ""

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE", {"tooltip": "The images to potentially save."}),
                "filename_prefix": ("STRING", {"default": "ComfyUI", "tooltip": "The prefix for the file to save. This may include formatting information such as %date:yyyy-MM-dd% or %Empty Latent Image.width% to include values from nodes."}),
                "enable_save": ("BOOLEAN", {"default": True, "tooltip": "If enabled, images will be saved to the output directory. If disabled, images will only be previewed in the temporary directory."})
            },
            "hidden": {
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO"
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "save_preview_image"
    OUTPUT_NODE = True

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Conditionally saves images based on the enable_save parameter. When disabled, acts as a preview node."

    def save_preview_image(self, images, filename_prefix="A1rSpace", enable_save=True, prompt=None, extra_pnginfo=None):
        if enable_save:
            output_dir = self.output_dir
            output_type = "output"
            actual_prefix = filename_prefix
        else:
            output_dir = self.temp_dir
            output_type = "temp"
            actual_prefix = filename_prefix + "_temp_" + ''.join(random.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(5))
        
        actual_prefix += self.prefix_append
        
        full_output_folder, filename, counter, subfolder, filename_prefix = folder_paths.get_save_image_path(
            actual_prefix, output_dir, images[0].shape[1], images[0].shape[0]
        )
        
        results = list()
        for (batch_number, image) in enumerate(images):
            i = 255. * image.cpu().numpy()
            img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
            
            metadata = None
            try:
                from comfy.cli_args import args
                disable_metadata = args.disable_metadata
            except:
                disable_metadata = False
                
            if not disable_metadata:
                metadata = PngImagePlugin.PngInfo()
                if prompt is not None:
                    metadata.add_text("prompt", json.dumps(prompt))
                if extra_pnginfo is not None:
                    for x in extra_pnginfo:
                        metadata.add_text(x, json.dumps(extra_pnginfo[x]))
            
            filename_with_batch_num = filename.replace("%batch_num%", str(batch_number))
            file = f"{filename_with_batch_num}_{counter:05}_.png"
            
            img.save(
                os.path.join(full_output_folder, file), 
                pnginfo=metadata, 
                compress_level=self.compress_level
            )
            
            results.append({
                "filename": file,
                "subfolder": subfolder,
                "type": output_type
            })
            counter += 1
            
        return {"ui": {"images": results}}

UTILS_CLASS_MAPPINGS = {
    "A1r Int to Boolean": Int_to_Boolean,
    "A1r Simple Boolean": Simple_Boolean,
    "A1r Boolean Plus": Boolean_Plus,
    "A1r Boolean to Int": Boolean_to_Int,
    "A1r Boolean AB": Boolean_AB,
    "A1r Boolean A B": Boolean_A_B,
    "A1r Math Int": Math_Int,
    "A1r Math LogicGate": Math_LogicGate,
    "A1r Save PreviewImage": Save_PreviewImage,
}

UTILS_DISPLAY_NAME_MAPPINGS = {
    "A1r Int to Boolean": "Int to Boolean",
    "A1r Simple Boolean": "Simple Boolean",
    "A1r Boolean Plus": "Boolean Plus",
    "A1r Boolean to Int": "Boolean to Int",
    "A1r Boolean AB": "Boolean A&B",
    "A1r Boolean A B": "Boolean A|B",
    "A1r Math Int": "Math Int",
    "A1r Math LogicGate": "Math LogicGate",
    "A1r Save PreviewImage": "Save/Preview Image",
}
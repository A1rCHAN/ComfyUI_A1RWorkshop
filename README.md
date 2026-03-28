Re-build version of my custom node: [A1rSpace](https://registry.comfy.org/nodes/comfyui_a1rspace)  
Will be public to ComfyUI Registry when it done.  
However, you could downlaod this repo to use it for now, just needs to pay attention to the update.  

# A1RWorkshop  
A1RWorkshop is a custom node and frontend function packages for ComfyUI that simplify usese.  
Frontend design based on ComfyUI Nodes2.0, automatically compatible with different themes.  
Since the official future mainstream of ComfyUI is Nodes2.0, this repo is also developed based on Nodes2.0, but it is still compatible with old UI. However, it will not make too many optimizations or compatibilities to the old frontend. (Unless the official eventually retains the old style)  

## Function descriptions  
### Embedding Tags binds to the model
The "Open Embedding Editor" option has been added to the context menu of the model loading node, which can open a window to edit and manage the embedding terms.  
The "Open Embedding Manager" option has been added to the context menu of the canvas, which can open a window to manage embedded terms.  

tips: Using it to embedding models trigger tags, style tags, quality tags, etc. It will bind the embedding to the model. In this way, you can easily switch between different models and shoulden't change text encode anymore.  

### Models Preview popover  
Same as the "Embedding Tags" option, added to the context menu of the canvas and nodes, which can open a window to manage or edit the image, support multi-image playback.  
With this function, you can easily to toggle models without model name check.  

### Image Crop  
Added "Open Crop Editor" option to the context menu of the Load Image nodes, which can open a window to crop the image like Windows Photo App.  

## Nodes description  
### Collectors  
"Widget Collector" and "Mode Collector". They can collect widgets and nodes, respectively.  
They have a button, toggled it to open the collect mode, then other nodes will append a overlay to their widget or menu bar.  
Click the overlay to collect the widget or node. The value of widgets which are collected will be syncly updated to the original panel. The node will be a bool in the node panel, you can toggle node mode to bypass or mute, option in context menu.  

warn: The function of the collector is not implemented yet.  

### Seed Control  
A random seed node. It hava two buttons: "manural random" and "pull history".  
The "manural random" button will random a seed. The "pull history" button shows 10 seeds value from queued history, and the history seed have a popover to show the image.  
These two buttons will queue prompt when cliked.  

### Size Canvas  
A 2D slider in the "Canvas Size" panel, it will update the width and height size when changed, provids a preset list.  
The range and step of the slider is configable, you can find "Canvas Setting" in the context menu, they are not customizable, but the value range which I provide is enough for most of the use case.  
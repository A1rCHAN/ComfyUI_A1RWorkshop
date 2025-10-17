# ComfyUI_A1rSpace
A comfyui custom node package used by myself.

## Installation and Update
### Installation:
* Clone the repo into the custom_nodes directory and install the requirements:
  ```
  git clone https://github.com/A1rCHAN/ComfyUI_A1rSpace.git
  ```
* Install dependencies in your Python environment.
  * For Windows Portable, run the following command inside `ComfyUI\custom_nodes\ComfyUI_A1rSpace`:
    ```
    ..\..\..\python_embeded\python.exe -m pip install -r requirements.txt
    ```
  * If your ComfyUI venv inside `ComfyUI\.venv\Scripts\python.exe`:
    ```
    ..\..\.venv\Scripts\python.exe -m pip install -r requirements.txt
    ```
  * For using venv or conda, activate your Python environment first, then run:
    ```
    pip install -r requirements.txt
    ```

### Update:
* Inside `ComfyUI\custom_nodes\ComfyUI_A1rSpace`:
  ```
  git pull
  ```
## Update history
### version 1.0.2:
- Fixed collapse outputs function and other bugs, can work normally now.
### version 1.0.1:
- Demo version
### version 1.0.0:
- Push project

## Plan TODO:
1. Improve front interaction.
2. Add and modify more nodes to provide complete functions.
3. Language support with Chinese.

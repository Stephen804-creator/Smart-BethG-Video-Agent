# Model Routing Setup

Smart-BethG Video Agent now treats the model as a replaceable provider.

For the first local Wan 2.2 integration, install a tested Wan workflow in ComfyUI and set:

COMFYUI_URL=http://your-comfyui-host:8188
COMFYUI_MODEL_PROFILE=wan2.2

The workflow must be supplied through COMFYUI_WORKFLOW_PATH. The current worker does not download model weights automatically and does not claim that an arbitrary workflow is Wan-compatible.

Supported local profile identifiers are:

- wan2.2
- ltx-2.5
- vace-wan

Only the profile matching COMFYUI_MODEL_PROFILE is advertised as configured. This prevents the router from pretending that a model is available when the corresponding workflow has not been installed and tested.

Premium slots for Seedance 2.5 and Veo 3.1 are present in the registry but intentionally not executable yet. They remain disabled until their official API adapters are implemented and tested.

The router also carries a training-output policy. Production requests can use generation-only providers. Requests marked purpose=training-data cannot select a provider unless its policy explicitly says trainingOutput=true.

The current local profiles use the existing ComfyUI execution gateway. The exact checkpoint, workflow, license, VRAM requirement, and output permissions must be recorded separately for the deployment.

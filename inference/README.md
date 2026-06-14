# Inference (planned)

Same shape as the NYC project: deploy a fine-tuned
`Qwen/Image-Edit` LoRA on [Modal](https://modal.com) and call
`edit_b64` for each quadrant render.

```bash
uv run modal setup
uv run modal deploy inference/server.py   # TODO
```

The endpoint URL goes into `.env` as `MODAL_INFERENCE_URL`.

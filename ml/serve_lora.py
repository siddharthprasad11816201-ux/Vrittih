#!/usr/bin/env python3
"""Serve your fine-tuned model (base + the LoRA adapter from ml/model/lora/) as a LOCAL,
OpenAI-compatible chat endpoint — exactly what the coach's selfhost / narrator brains speak.
Runs on your machine; nothing leaves it.

    python ml/serve_lora.py          # POST /v1/chat/completions on 127.0.0.1:8078

Then point the coach at it:
    COACH_BRAIN=selfhost  COACH_NARRATE=on
    COACH_LLM_URL=http://localhost:8078/v1/chat/completions

If ml/model/lora/ is absent it serves the base model. Override base with BASE_MODEL,
port with PORT. Loads in 4-bit so a 1.5B fits ~2GB VRAM.
"""
import json, os
# xet transfer backend fails on flaky links; default to plain resumable HTTPS (override HF_HUB_DISABLE_XET=0).
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", "60")  # tolerate slow links
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

HERE = os.path.dirname(os.path.abspath(__file__))
ADAPTER = os.path.join(HERE, "model", "lora")


def _resolve_base():
    # BASE_MODEL overrides; else read the base the adapter was trained on (peft writes it
    # into adapter_config.json) so base + adapter can never mismatch; else default.
    if os.environ.get("BASE_MODEL"):
        return os.environ["BASE_MODEL"]
    cfg = os.path.join(ADAPTER, "adapter_config.json")
    if os.path.isfile(cfg):
        try:
            b = json.load(open(cfg, encoding="utf-8")).get("base_model_name_or_path")
            if b:
                return b
        except Exception:
            pass
    return "Qwen/Qwen2.5-1.5B-Instruct"


BASE = _resolve_base()

bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                         bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_use_double_quant=True)
tok = AutoTokenizer.from_pretrained(BASE)
if tok.pad_token is None:
    tok.pad_token = tok.eos_token
model = AutoModelForCausalLM.from_pretrained(BASE, quantization_config=bnb, device_map="auto")
if os.path.isdir(ADAPTER):
    from peft import PeftModel
    model = PeftModel.from_pretrained(model, ADAPTER)
    print(f"Loaded LoRA adapter from {ADAPTER}")
else:
    print(f"No adapter at {ADAPTER} — serving the base model {BASE}.")
model.eval()


def generate(messages, max_new_tokens=256, temperature=0.3):
    prompt = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tok(prompt, return_tensors="pt").to(model.device)
    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=max_new_tokens,
                             do_sample=temperature > 0, temperature=max(temperature, 0.01),
                             pad_token_id=tok.eos_token_id)
    return tok.decode(out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        # Friendly health check — opening the URL in a browser (GET) shouldn't look broken.
        self._send(200, {"status": "ok", "model": "fine-tuned (base + LoRA)" if os.path.isdir(ADAPTER) else "base",
                         "endpoint": "/v1/chat/completions", "method": "POST",
                         "usage": 'POST JSON {"messages":[{"role":"user","content":"hi"}]}'})

    def do_POST(self):
        if not self.path.endswith("/chat/completions"):
            return self._send(404, {"error": "not found"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}")
            msgs = body.get("messages") or []
            content = generate(msgs, int(body.get("max_tokens", 256)), float(body.get("temperature", 0.3)))
            self._send(200, {"choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}]})
        except Exception as e:  # noqa: BLE001
            self._send(500, {"error": str(e)})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8078"))
    print(f"fine-tuned model on http://127.0.0.1:{port}/v1/chat/completions")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()

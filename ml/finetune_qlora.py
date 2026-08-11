#!/usr/bin/env python3
"""ICIRE — QLoRA fine-tune an OPEN model (e.g. Mistral 7B) on your own coaching data, on
your own GPU. This ADAPTS an open model (not from scratch): a 4-bit base + small LoRA
adapters, which fits a single consumer GPU. LoRA adapters are saved to ml/model/lora/.

    npm run ml:sft                              # build ml/data/sft.jsonl (seed; grow it)
    pip install torch transformers peft bitsandbytes datasets accelerate
    python ml/finetune_qlora.py --base mistralai/Mistral-7B-Instruct-v0.3

Then serve the base + adapter (vLLM/llama.cpp/TGI) with an OpenAI-compatible endpoint and
point COACH_LLM_URL at it (COACH_BRAIN=selfhost for classification, COACH_NARRATE=on for
grounded generation). Needs ~12-16GB+ VRAM for a 7B QLoRA; use a smaller base on less.
"""
import argparse, json, os

# HuggingFace's xet transfer backend fails on flaky/slow links ("CAS Client Error: error
# decoding response body"). Default to plain resumable HTTPS; override with HF_HUB_DISABLE_XET=0.
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", "60")  # tolerate slow links (default 10s -> handshake/read timeouts)

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "sft.jsonl")
OUT = os.path.join(HERE, "model", "lora")


def _base_billions(name):
    import re
    m = re.search(r"(\d+(?:\.\d+)?)\s*[bB]\b", name or "")
    return float(m.group(1)) if m else 7.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="mistralai/Mistral-7B-Instruct-v0.3")
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--maxlen", type=int, default=1024)
    ap.add_argument("--force", action="store_true", help="skip the VRAM preflight (may OOM)")
    args = ap.parse_args()

    import torch

    # VRAM preflight BEFORE the ~GBs model download — rough 4-bit QLoRA need by size.
    vram = round(torch.cuda.get_device_properties(0).total_memory / 1e9, 1) if torch.cuda.is_available() else 0
    b = _base_billions(args.base)
    need = 3.0 if b <= 1.6 else 4.5 if b <= 3 else 8.0 if b <= 8 else 16.0
    print(f"GPU VRAM: {vram} GB · base '{args.base}' (~{b}B) needs ~{need} GB for QLoRA.")
    if vram and vram + 0.5 < need and not args.force:
        raise SystemExit(
            f"\n✗ Not enough VRAM: {vram} GB < ~{need} GB.\n"
            f"  On {vram} GB, fine-tune a SMALL base instead, e.g.:\n"
            f"    python ml/finetune_qlora.py --base Qwen/Qwen2.5-1.5B-Instruct\n"
            f"    python ml/finetune_qlora.py --base microsoft/Phi-3.5-mini-instruct   # ~3.8B, tight\n"
            f"  Or skip fine-tuning: your from-scratch intent classifier already runs here,\n"
            f"  and for generation serve a small model via Ollama (COACH_NARRATE=on).\n"
            f"  (Add --force to try anyway.)\n"
        )
    from datasets import Dataset
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from trl import SFTTrainer, SFTConfig  # modern trl (>=1.x): training args go in SFTConfig

    # Prefer the Node-built ml/data/sft.jsonl (messages format); else build straight from
    # the committed ml/sft_seed.jsonl ({user, assistant}) so NO Node is needed — important
    # on an HPC cluster where you just git-clone and run Python.
    SEED = os.path.join(HERE, "sft_seed.jsonl")
    SYS = "You are Vrittih's in-house career coach. Answer only from the user's real profile and live roles; never invent numbers or salaries."
    if os.path.exists(DATA):
        rows = [json.loads(l) for l in open(DATA, encoding="utf-8") if l.strip()]
    elif os.path.exists(SEED):
        rows = []
        for l in open(SEED, encoding="utf-8"):
            if not l.strip():
                continue
            o = json.loads(l)
            if o.get("user") and o.get("assistant"):
                rows.append({"messages": [{"role": "system", "content": SYS}, {"role": "user", "content": o["user"]}, {"role": "assistant", "content": o["assistant"]}]})
        print(f"Built {len(rows)} training rows from ml/sft_seed.jsonl (no Node needed).")
    else:
        raise SystemExit("No training data — need ml/data/sft.jsonl (npm run ml:sft) or ml/sft_seed.jsonl")
    ds = Dataset.from_list(rows)

    tok = AutoTokenizer.from_pretrained(args.base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token

    bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                             bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_use_double_quant=True)
    model = AutoModelForCausalLM.from_pretrained(args.base, quantization_config=bnb, device_map="auto")
    model = prepare_model_for_kbit_training(model)
    lora = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, bias="none", task_type="CAUSAL_LM",
                      target_modules=["q_proj", "k_proj", "v_proj", "o_proj"])
    model = get_peft_model(model, lora)

    # modern trl SFTTrainer: conversational rows ({"messages":[...]}) are formatted via the
    # tokenizer's chat template automatically; training args live in SFTConfig; the tokenizer
    # is passed as processing_class. (Older trl used tokenizer=/dataset_text_field=/max_seq_length=.)
    os.makedirs(OUT, exist_ok=True)
    cfg = SFTConfig(output_dir=OUT, per_device_train_batch_size=1, gradient_accumulation_steps=8,
                    num_train_epochs=args.epochs, learning_rate=2e-4, bf16=torch.cuda.is_available(),
                    logging_steps=5, save_strategy="epoch", report_to=[], max_length=args.maxlen)
    try:
        trainer = SFTTrainer(model=model, args=cfg, train_dataset=ds, processing_class=tok)
    except TypeError:
        # very old trl fallback
        trainer = SFTTrainer(model=model, args=cfg, train_dataset=ds, tokenizer=tok)
    trainer.train()
    model.save_pretrained(OUT)
    tok.save_pretrained(OUT)
    print(f"Saved LoRA adapters -> {OUT}. Merge/serve with your inference stack (vLLM/llama.cpp/TGI).")


if __name__ == "__main__":
    main()

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
    from transformers import (AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig,
                              TrainingArguments)
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from trl import SFTTrainer  # trl provides SFTTrainer over chat data

    if not os.path.exists(DATA):
        raise SystemExit("Missing ml/data/sft.jsonl — run:  npm run ml:sft")
    rows = [json.loads(l) for l in open(DATA, encoding="utf-8") if l.strip()]
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

    def fmt(ex):
        return {"text": tok.apply_chat_template(ex["messages"], tokenize=False, add_generation_prompt=False)}
    ds = ds.map(fmt)

    os.makedirs(OUT, exist_ok=True)
    trainer = SFTTrainer(
        model=model, tokenizer=tok, train_dataset=ds, dataset_text_field="text",
        max_seq_length=args.maxlen,
        args=TrainingArguments(output_dir=OUT, per_device_train_batch_size=1,
                               gradient_accumulation_steps=8, num_train_epochs=args.epochs,
                               learning_rate=2e-4, bf16=True, logging_steps=5, save_strategy="epoch",
                               report_to=[]),
    )
    trainer.train()
    model.save_pretrained(OUT)
    tok.save_pretrained(OUT)
    print(f"Saved LoRA adapters -> {OUT}. Merge/serve with your inference stack (vLLM/llama.cpp/TGI).")


if __name__ == "__main__":
    main()
